// src/multi-agent/orchestrator.ts
//
// Sub-agent spawning. Each spawn:
//   1. Creates an isolated session (kind='isolated', linked to the parent).
//   2. Builds an extra system-prompt slice — profile role + goal ancestry +
//      sub-agent framing. The child does NOT inherit the parent's chat history
//      (forked context); it does inherit the workspace via ContextEngine.
//   3. Restricts the child's tools to the profile's allowlist.
//   4. Archives the child session when spawn() returns.
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';
import { PROFILES, type AgentProfile } from './profiles/index.js';

export interface SpawnRequest {
  task: string;
  parentSessionKey: string;
  /** Named profile: 'search' | 'communicator' | 'researcher' | 'coder'. Omit for ad-hoc. */
  profileId?: string;
  /** Goal ancestry — highest-level mission down to the immediate task. */
  goalChain?: string[];
  model?: string;
}

export interface SpawnResult {
  ok: boolean;
  summary: string;
  toolCalls: number;
  tokensUsed: number;
  durationMs: number;
  childSessionKey: string;
  profileId: string | null;
  error?: string;
}

export interface OrchestratorOptions {
  runner: AgentRunner;
  sessions: SessionStore;
  contextEngine: ContextEngine;
  config: Config;
}

function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class MultiAgentOrchestrator {
  private readonly runner: AgentRunner;
  private readonly sessions: SessionStore;
  private readonly contextEngine: ContextEngine;
  private readonly config: Config;

  constructor(opts: OrchestratorOptions) {
    this.runner = opts.runner;
    this.sessions = opts.sessions;
    this.contextEngine = opts.contextEngine;
    this.config = opts.config;
  }

  resolveProfile(profileId: string | undefined): AgentProfile | null {
    if (!profileId) return null;
    return PROFILES[profileId] ?? null;
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    const start = Date.now();
    const profile = this.resolveProfile(req.profileId);
    const childKey = `subagent:${req.parentSessionKey}:${randomKey()}`;
    const model = this.modelFor(profile, req.model);

    // Isolated session — its own row, linked to the parent, no shared history.
    const session = this.sessions.ensureSession(
      childKey,
      'subagent',
      null,
      model,
      'isolated',
      req.parentSessionKey,
    );

    const framing =
      '[You are a sub-agent spawned for ONE specific task. Complete it and return a ' +
      'structured result. Do not chitchat. Do not chain into unrelated work.]';
    const profileText = profile
      ? `\n\n## Your role\n${profile.role}.\nReports to: ${profile.reportsTo}.\n\n${profile.bootstrap}`
      : '';
    const goalText =
      req.goalChain && req.goalChain.length > 0
        ? '\n\n## Goal ancestry (why this matters)\n' +
          req.goalChain.map((g, i) => `${i + 1}. ${g}`).join('\n')
        : '';

    // Forked context: workspace identity/memory + the sub-agent slice — but
    // NOT the parent's conversation history (history: []).
    const systemPrompt = `${this.contextEngine.bootstrap().systemPrompt}\n\n---\n\n${framing}${profileText}${goalText}`;

    try {
      const result = await this.runner.run({
        session,
        systemPrompt,
        history: [],
        userText: req.task,
        ...(profile ? { allowedToolNames: profile.toolAllowlist } : {}),
      });
      return {
        ok: true,
        summary: result.reply,
        toolCalls: result.toolCalls,
        tokensUsed: 0,
        durationMs: Date.now() - start,
        childSessionKey: childKey,
        profileId: profile?.id ?? null,
      };
    } catch (e) {
      return {
        ok: false,
        summary: '',
        toolCalls: 0,
        tokensUsed: 0,
        durationMs: Date.now() - start,
        childSessionKey: childKey,
        profileId: profile?.id ?? null,
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      this.sessions.archiveSession(childKey);
    }
  }

  async spawnParallel(reqs: SpawnRequest[]): Promise<SpawnResult[]> {
    const results: SpawnResult[] = [];
    const batchSize = 4;
    for (let i = 0; i < reqs.length; i += batchSize) {
      const batch = reqs.slice(i, i + batchSize);
      results.push(...(await Promise.all(batch.map((r) => this.spawn(r)))));
    }
    return results;
  }

  private modelFor(profile: AgentProfile | null, override: string | undefined): string {
    if (override) return override;
    if (profile?.defaultModel === 'pro') return this.config.gemini.defaultModel;
    return this.config.gemini.fallbackModel;
  }
}
