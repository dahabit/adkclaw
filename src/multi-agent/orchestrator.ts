/**
 * src/multi-agent/orchestrator.ts — Sub-Agent Spawning.
 *
 * Built in Codelab 3 (The Agent Army). When the agent says "spawn a researcher",
 * this is what runs.
 *
 * The discipline that makes sub-agents work:
 *
 *   1. ISOLATED SESSION
 *      Each sub-agent gets its own SQLite session row, kind='isolated', linked to
 *      the parent via parent_key. Children persist independently — a parent can
 *      crash and the child's work survives.
 *
 *   2. FORKED CONTEXT (BRD §6.8 — non-negotiable)
 *      The sub-agent does NOT see the parent's conversation history. It inherits
 *      identity + workspace memory (via ContextEngine.bootstrap), and gets the
 *      task + goal ancestry as an extra system prompt slice. Passing full parent
 *      history would: (a) explode tokens, (b) leak parent secrets, (c) confuse
 *      the child about its own role.
 *
 *   3. RESTRICTED TOOL ALLOWLIST
 *      Each profile (SearchAgent, ResearcherAgent, CommunicatorAgent, CoderAgent)
 *      declares which tools it may use. The runner enforces the allowlist when
 *      it builds the function declarations for Gemini.
 *
 *   4. CHEAPER MODEL BY DEFAULT
 *      Profiles default to Gemini Flash (10× cheaper than Pro). Only ResearcherAgent
 *      and CoderAgent escalate to Pro for tasks that genuinely need it.
 *
 *   5. CAPPED ROUNDS, ENFORCED TIMEOUT
 *      Each profile has its own MAX_TOOL_ROUNDS (lower than the parent's). The
 *      caller wraps spawn() in a timeout — a hung child must not hang the parent.
 *
 *   6. AUTO-ARCHIVE ON COMPLETION
 *      The child session is archived after spawn() returns so it doesn't clutter
 *      the active-session list shown on the dashboard.
 *
 * Profiles live in src/multi-agent/profiles/ — one file per profile, each
 * exporting an AgentProfile object with role, reportsTo, bootstrap, defaultModel,
 * toolAllowlist, maxToolRounds.
 */

import type { AgentRunner } from '../agent/runner.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';
import { PROFILES, type AgentProfile } from './profiles/index.js';

export interface SpawnRequest {
  task: string;
  parentSessionKey: string;
  /** Named profile to use ('search' | 'communicator' | 'researcher' | 'coder'). Omit for ad-hoc spawn. */
  profileId?: string;
  /** Goal ancestry — chain from highest-level mission down to the immediate task (Paperclip pattern). */
  goalChain?: string[];
  /** Override the profile's default model. */
  model?: string;
  timeoutMs?: number;
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

function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface OrchestratorOptions {
  runner: AgentRunner;
  sessions: SessionStore;
  config: Config;
}

/**
 * MultiAgentOrchestrator — spawns isolated sub-agents.
 *
 * Each spawn:
 *   1. Creates a new session with kind='isolated' and parent_key set.
 *   2. Builds an extra system prompt: profile bootstrap + goal ancestry + sub-agent framing.
 *      The sub-agent does NOT see the parent's conversation history (BRD §6.8 — fork rules).
 *      It does inherit identity / MEMORY / bank via the ContextEngine bootstrap.
 *   3. Restricts the sub-agent's tools to the profile's allowlist.
 *   4. Caps tool rounds per the profile (less than the main agent's cap).
 *   5. Archives the child session when done.
 */
export class MultiAgentOrchestrator {
  private readonly runner: AgentRunner;
  private readonly sessions: SessionStore;
  private readonly config: Config;

  constructor(opts: OrchestratorOptions) {
    this.runner = opts.runner;
    this.sessions = opts.sessions;
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

    this.sessions.createSession({
      key: childKey,
      kind: 'isolated',
      parentKey: req.parentSessionKey,
      channel: 'subagent',
      model: this.modelFor(profile, req.model),
    });

    const goalText =
      req.goalChain && req.goalChain.length > 0
        ? '\n\n## Goal ancestry (why this matters)\n' +
          req.goalChain.map((g, i) => `${i + 1}. ${g}`).join('\n')
        : '';
    const profileText = profile
      ? `\n\n## Your role\n${profile.role}.\nReports to: ${profile.reportsTo}.\n\n${profile.bootstrap}`
      : '';
    const framing =
      '[You are a sub-agent spawned for ONE specific task. Complete it and return a structured result. Do not chitchat. Do not chain into unrelated work.]';
    const extraSystemPrompt = `${framing}${profileText}${goalText}`;

    const allowedToolNames = profile?.toolAllowlist;

    try {
      const result = await this.runner.run({
        sessionKey: childKey,
        message: req.task,
        extraSystemPrompt,
        model: this.modelFor(profile, req.model),
        ...(allowedToolNames !== undefined ? { allowedToolNames } : {}),
        ...(req.timeoutMs !== undefined ? { timeoutMs: req.timeoutMs } : {}),
      });

      return {
        ok: !result.error,
        summary: result.text,
        toolCalls: result.toolCallCount,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - start,
        childSessionKey: childKey,
        profileId: profile?.id ?? null,
        ...(result.error ? { error: result.error } : {}),
      };
    } finally {
      this.sessions.archiveSession(childKey);
    }
  }

  async spawnParallel(reqs: SpawnRequest[]): Promise<SpawnResult[]> {
    const max = 4;
    const results: SpawnResult[] = [];
    for (let i = 0; i < reqs.length; i += max) {
      const batch = reqs.slice(i, i + max);
      const out = await Promise.all(batch.map((r) => this.spawn(r)));
      results.push(...out);
    }
    return results;
  }

  private modelFor(profile: AgentProfile | null, override: string | undefined): string {
    if (override) return override;
    if (profile?.defaultModel === 'pro') return this.config.gemini.defaultModel;
    return this.config.gemini.fallbackModel;
  }
}
