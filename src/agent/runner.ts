/**
 * src/agent/runner.ts — The agent loop.
 *
 * This is the heart of AdkClaw. Everything else (tools, memory, channels, healing, sub-agents)
 * exists to support what happens here: a `for` loop that calls the LLM, executes any tool calls
 * it asks for, and keeps going until the LLM produces a final text response.
 *
 * The pattern (BRD §6.1, taught in Codelab 1):
 *
 *     1. Receive user message + bootstrap system prompt from workspace files
 *     2. Append user message to session history (persisted in SQLite)
 *     3. Call Gemini with: system prompt + history + tool function declarations
 *     4. If response contains tool calls:
 *           - For each call: registry.execute() → append functionResponse to history
 *           - Loop back to (3)
 *        Else (LLM produced text):
 *           - Append assistant message to history
 *           - Return to caller
 *     5. Cap at MAX_TOOL_ROUNDS to prevent runaway tool loops
 *
 * This file deliberately does NOT contain any business logic about specific tools, channels,
 * or memory shapes. It delegates everything via dependency injection:
 *
 *   - ContextEngine assembles the system prompt (workspace files)
 *   - ToolRegistry knows which tools exist and how to execute them
 *   - SessionStore persists every message
 *   - HealingEngine wraps the Gemini call for retry/fallback
 *   - BudgetGuard enforces per-sender token caps
 *
 * Read this top-to-bottom to understand the agent loop. Then read the tools/, context/, and
 * healing/ directories to see what each injected dependency actually does.
 */

import type {
  GoogleGenAI,
  Content,
  Part,
  FunctionCall,
  GenerateContentResponse,
} from '@google/genai';
import type {
  AgentRequest,
  AgentResponse,
  Config,
  FinishReason,
  Message,
  Session,
  ToolContext,
} from '../types/index.js';
import type { ContextEngine } from '../context/manager.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { SessionStore } from '../sessions/store.js';
import type { HealingEngine } from '../healing/index.js';
import type { BudgetGuard } from './budget.js';

export interface ToolCallTrace {
  toolName: string;
  ok: boolean;
  preview: string;
}

export interface AgentRunnerCallbacks {
  beforeTurn?: (session: Session, message: string) => void | Promise<void>;
  afterTurn?: (session: Session, response: AgentResponse) => void | Promise<void>;
  beforeTool?: (toolName: string, args: Record<string, unknown>) => void | Promise<void>;
  afterTool?: (trace: ToolCallTrace) => void | Promise<void>;
  onError?: (err: Error, ctx: { sessionKey: string; phase: string }) => void | Promise<void>;
}

export interface AgentRunnerOptions {
  client: GoogleGenAI;
  sessions: SessionStore;
  contextEngine: ContextEngine;
  registry: ToolRegistry;
  config: Config;
  callbacks?: AgentRunnerCallbacks;
  /** Optional self-healing wrapper. When provided, generateContent calls retry transient errors and fall back to fallbackModel on serverError/timeout. */
  healing?: HealingEngine;
  /** Optional budget guard. When provided, each turn checks the sender's daily token usage and refuses gracefully if over cap. */
  budget?: BudgetGuard;
}

interface FunctionCallPart {
  functionCall: FunctionCall;
}

interface FunctionResponsePart {
  functionResponse: {
    name: string;
    response: { content: unknown };
    id?: string;
  };
}

interface TextPart {
  text: string;
}

function isTextPart(p: Part): p is TextPart {
  return typeof (p as { text?: unknown }).text === 'string';
}

function isFunctionCallPart(p: Part): p is FunctionCallPart {
  return Boolean((p as { functionCall?: unknown }).functionCall);
}

/**
 * AgentRunner — the agent loop.
 *
 *   user message → bootstrap system prompt → call Gemini with tools
 *     → if tool calls: execute via registry, append responses, loop
 *     → if text: append assistant message, return
 *
 * Caps at config.agent.maxToolRounds so tool loops can't run forever.
 * Persists every turn (user + assistant + tool messages) to SessionStore.
 */
export class AgentRunner {
  private readonly client: GoogleGenAI;
  private readonly sessions: SessionStore;
  private readonly contextEngine: ContextEngine;
  private readonly registry: ToolRegistry;
  private readonly config: Config;
  private readonly callbacks: AgentRunnerCallbacks;
  private readonly healing?: HealingEngine;
  private readonly budget?: BudgetGuard;

  constructor(opts: AgentRunnerOptions) {
    this.client = opts.client;
    this.sessions = opts.sessions;
    this.contextEngine = opts.contextEngine;
    this.registry = opts.registry;
    this.config = opts.config;
    this.callbacks = opts.callbacks ?? {};
    if (opts.healing) this.healing = opts.healing;
    if (opts.budget) this.budget = opts.budget;
  }

  private async callGemini(
    model: string,
    contents: Content[],
    systemInstruction: string,
    sdkTools: Array<{ functionDeclarations: object[] }> | undefined,
  ): Promise<GenerateContentResponse> {
    const baseConfig = {
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(sdkTools ? { tools: sdkTools } : {}),
    };
    const primary = () =>
      this.client.models.generateContent({ model, contents, config: baseConfig });
    if (!this.healing) return primary();
    const fallback = () =>
      this.client.models.generateContent({
        model: this.config.gemini.fallbackModel,
        contents,
        config: baseConfig,
      });
    const { result } = await this.healing.protect(primary, fallback, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      context: 'generateContent',
    });
    return result;
  }

  async run(req: AgentRequest): Promise<AgentResponse> {
    const start = Date.now();
    const session = this.sessions.getOrCreateSession({
      key: req.sessionKey,
      channel: req.channel ?? null,
      target: req.target ?? null,
      senderId: req.senderId ?? null,
      model: req.model ?? this.config.gemini.defaultModel,
    });

    await this.callbacks.beforeTurn?.(session, req.message);

    this.sessions.appendMessage({
      sessionKey: session.key,
      role: 'user',
      content: req.message,
    });

    if (this.budget) {
      const verdict = this.budget.check(req.senderId ?? session.senderId);
      if (!verdict.ok) {
        const refusal = verdict.refusalText ?? 'Daily token budget reached.';
        this.sessions.appendMessage({
          sessionKey: session.key,
          role: 'assistant',
          content: refusal,
          tokens: 0,
          metadata: {
            reason: 'budget_exceeded',
            usedToday: verdict.usedToday,
            budget: verdict.budget,
          },
        });
        const refusalResponse: AgentResponse = {
          text: refusal,
          toolCallCount: 0,
          tokensUsed: 0,
          durationMs: Date.now() - start,
          finishReason: 'budget_exceeded',
        };
        await this.callbacks.afterTurn?.(session, refusalResponse);
        return refusalResponse;
      }
    }

    const bootstrap = this.contextEngine.bootstrap();
    const systemInstruction = req.extraSystemPrompt
      ? bootstrap.systemPrompt
        ? `${bootstrap.systemPrompt}\n\n---\n\n${req.extraSystemPrompt}`
        : req.extraSystemPrompt
      : bootstrap.systemPrompt;

    const history = this.sessions.listMessages(session.key);
    const contents: Content[] = this.toContents(history);

    const allDeclarations = this.registry.toFunctionDeclarations();
    const declarations = req.allowedToolNames
      ? allDeclarations.filter((d) => req.allowedToolNames!.includes(d.name))
      : allDeclarations;
    const sdkTools = declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;

    const model = req.model ?? this.config.gemini.defaultModel;
    const maxRounds = this.config.agent.maxToolRounds;

    let toolCallCount = 0;
    let totalTokens = 0;
    let finalText = '';
    let finishReason: FinishReason = 'completed';
    let lastError: string | undefined;

    try {
      let round = 0;
      while (round < maxRounds) {
        round += 1;
        const sdkResponse = await this.callGemini(model, contents, systemInstruction, sdkTools);

        const usage = sdkResponse.usageMetadata;
        if (usage?.totalTokenCount) totalTokens += usage.totalTokenCount;

        const candidate = sdkResponse.candidates?.[0];
        const parts: Part[] = candidate?.content?.parts ?? [];

        const calls = parts.filter(isFunctionCallPart);
        const textOutput = parts
          .filter(isTextPart)
          .map((p) => p.text)
          .join('');

        if (calls.length === 0) {
          finalText = textOutput;
          this.sessions.appendMessage({
            sessionKey: session.key,
            role: 'assistant',
            content: finalText,
            tokens: usage?.totalTokenCount ?? 0,
          });
          break;
        }

        contents.push({ role: 'model', parts });
        if (textOutput) {
          this.sessions.appendMessage({
            sessionKey: session.key,
            role: 'assistant',
            content: textOutput,
            tokens: 0,
          });
        }

        const toolCtx: ToolContext = {
          session,
          workspacePath: this.config.paths.workspace,
          config: this.config,
        };

        const responseParts: FunctionResponsePart[] = [];
        for (const part of calls) {
          const fc = part.functionCall;
          const toolName = fc.name ?? '';
          const args = (fc.args as Record<string, unknown> | undefined) ?? {};
          await this.callbacks.beforeTool?.(toolName, args);
          const toolResult = await this.registry.execute(toolName, args, toolCtx);
          toolCallCount += 1;

          const trace: ToolCallTrace = {
            toolName,
            ok: !toolResult.error,
            preview: (toolResult.result ?? toolResult.error ?? '').slice(0, 200),
          };
          await this.callbacks.afterTool?.(trace);

          this.sessions.appendMessage({
            sessionKey: session.key,
            role: 'tool',
            toolName,
            toolArgs: args,
            toolResult,
          });

          const responseContent: Record<string, unknown> = toolResult.error
            ? { error: toolResult.error }
            : { result: toolResult.result ?? '' };

          responseParts.push({
            functionResponse: {
              name: toolName,
              response: { content: responseContent },
              ...(fc.id ? { id: fc.id } : {}),
            },
          });
        }
        contents.push({ role: 'user', parts: responseParts as unknown as Part[] });
      }
      if (round >= maxRounds && !finalText) {
        finishReason = 'max_rounds';
        finalText = `(reached max tool rounds = ${maxRounds} without final response)`;
        this.sessions.appendMessage({
          sessionKey: session.key,
          role: 'assistant',
          content: finalText,
          tokens: 0,
        });
      }
    } catch (e) {
      finishReason = 'error';
      lastError = e instanceof Error ? e.message : String(e);
      finalText = '';
      await this.callbacks.onError?.(e instanceof Error ? e : new Error(lastError), {
        sessionKey: session.key,
        phase: 'generate',
      });
    }

    const response: AgentResponse = {
      text: finalText,
      toolCallCount,
      tokensUsed: totalTokens,
      durationMs: Date.now() - start,
      finishReason,
      ...(lastError ? { error: lastError } : {}),
    };
    await this.callbacks.afterTurn?.(session, response);
    return response;
  }

  private toContents(messages: Message[]): Content[] {
    const out: Content[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'tool') {
        if (m.toolName && m.toolResult) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(m.toolResult);
          } catch {
            parsed = { result: m.toolResult };
          }
          const fr: FunctionResponsePart = {
            functionResponse: {
              name: m.toolName,
              response: { content: parsed as Record<string, unknown> },
            },
          };
          out.push({ role: 'user', parts: [fr as unknown as Part] });
        }
        continue;
      }
      const role = m.role === 'assistant' ? 'model' : 'user';
      out.push({
        role,
        parts: [{ text: m.content ?? '' }] as Part[],
      });
    }
    return out;
  }
}
