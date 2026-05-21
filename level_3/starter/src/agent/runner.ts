// src/agent/runner.ts
import { GoogleGenAI, type Content, type FunctionCall, type Part } from '@google/genai';
import type { Config, Session, ToolContext } from '../types/index.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { HealingEngine } from '../healing/index.js';

// MAX_TOOL_ROUNDS caps the loop so a misbehaving model can't ping-pong tools
// forever. 15 is more than enough for any real task — hitting it is a bug
// worth investigating, not a value to bump.
const MAX_TOOL_ROUNDS = 15;

export interface RunRequest {
  session: Session;
  systemPrompt: string;
  history: Content[];
  userText: string;
  /** If set, only tools whose name is in this list are exposed to the model.
   *  Sub-agent profiles use this to restrict a child's capabilities. */
  allowedToolNames?: string[];
}

export interface RunResult {
  reply: string;
  toolCalls: number;
  rounds: number;
  newHistory: Content[];
}

export class AgentRunner {
  // `healing` is optional: when provided, every Gemini call is wrapped in the
  // recovery pyramid (retry transient errors, fall back Pro → Flash).
  constructor(
    private readonly client: GoogleGenAI,
    private readonly registry: ToolRegistry,
    private readonly config: Config,
    private readonly healing?: HealingEngine,
  ) {}

  async run(req: RunRequest): Promise<RunResult> {
    const history: Content[] = [...req.history, { role: 'user', parts: [{ text: req.userText }] }];
    let toolCalls = 0;

    // Build the tool list — restricted to the allowlist when one is provided.
    let declarations = this.registry.toFunctionDeclarations();
    if (req.allowedToolNames) {
      const allow = new Set(req.allowedToolNames);
      declarations = declarations.filter((d) => allow.has(d.name));
    }
    const sdkTools: Array<{ functionDeclarations: object[] }> | undefined =
      declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const genConfig = {
        systemInstruction: req.systemPrompt,
        ...(sdkTools ? { tools: sdkTools } : {}),
      };
      const callModel = (model: string) =>
        this.client.models.generateContent({ model, contents: history, config: genConfig });

      // Recovery pyramid: retry transient errors, then fall back Pro → Flash.
      const response = this.healing
        ? (
            await this.healing.protect(
              () => callModel(this.config.gemini.defaultModel),
              () => callModel(this.config.gemini.fallbackModel),
            )
          ).result
        : await callModel(this.config.gemini.defaultModel);

      const calls: FunctionCall[] = response.functionCalls ?? [];

      // No tool calls? The model is done — return its text answer.
      if (calls.length === 0) {
        const text = response.text ?? '';
        history.push({ role: 'model', parts: [{ text }] });
        return { reply: text, toolCalls, rounds: round + 1, newHistory: history };
      }

      // Otherwise: record the request, run each tool, append the responses.
      history.push({ role: 'model', parts: calls.map((call) => ({ functionCall: call })) });

      const responseParts: Part[] = [];
      for (const call of calls) {
        toolCalls++;
        const ctx: ToolContext = {
          session: req.session,
          workspacePath: this.config.paths.workspace,
          config: this.config,
        };
        const result = await this.registry.invoke(call.name ?? '', call.args ?? {}, ctx);
        responseParts.push({
          functionResponse: { name: call.name ?? '', response: { result } },
        });
      }
      history.push({ role: 'user', parts: responseParts });
    }

    return {
      reply: '(Tool round limit reached — stopping for safety.)',
      toolCalls,
      rounds: MAX_TOOL_ROUNDS,
      newHistory: history,
    };
  }
}
