import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { MultiAgentOrchestrator } from './orchestrator.js';
import { AgentRunner } from '../agent/runner.js';
import { SessionStore } from '../sessions/store.js';
import { ContextEngine } from '../context/manager.js';
import { ToolRegistry } from '../tools/registry.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../types/index.js';

function makeConfig(workspace: string): Config {
  return {
    server: { port: 0, host: 'localhost' },
    paths: { workspace, database: ':memory:' },
    gemini: {
      apiKey: 'fake',
      defaultModel: 'gemini-2.5-pro',
      fallbackModel: 'gemini-2.5-flash',
    },
    telegram: { botToken: '', allowedSenders: [] },
    agent: {
      name: 'TestAgent',
      tone: 'direct',
      traits: [],
      maxToolRounds: 5,
      compactionThreshold: 0.8,
      heartbeatIntervalMs: 0,
      timezone: 'UTC',
      dailyTokenBudget: 100_000,
    },
    vertex: { project: null, region: 'us-central1' },
  };
}

let workspace: string;
let sessions: SessionStore;
let registry: ToolRegistry;
let runner: AgentRunner;
let orchestrator: MultiAgentOrchestrator;
let generateContent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-orch-'));
  sessions = new SessionStore({ databasePath: ':memory:' });
  const ctxEngine = new ContextEngine({ workspacePath: workspace });
  registry = new ToolRegistry();
  registry.register({
    name: 'web_search',
    description: 's',
    permission: 'allow',
    parameters: { type: 'object', description: '', properties: {}, required: [] },
    async execute() {
      return { success: true, result: 'search ok' };
    },
  });
  registry.register({
    name: 'shell',
    description: 's',
    permission: 'allow',
    parameters: { type: 'object', description: '', properties: {}, required: [] },
    async execute() {
      return { success: true, result: 'shell ok' };
    },
  });
  generateContent = vi.fn().mockResolvedValue({
    candidates: [{ content: { parts: [{ text: 'sub-agent done' }] } }],
    usageMetadata: { totalTokenCount: 5 },
  });
  const client = { models: { generateContent } } as unknown as GoogleGenAI;
  runner = new AgentRunner({
    client,
    sessions,
    contextEngine: ctxEngine,
    registry,
    config: makeConfig(workspace),
  });
  orchestrator = new MultiAgentOrchestrator({
    runner,
    sessions,
    config: makeConfig(workspace),
  });
});

describe('MultiAgentOrchestrator.spawn', () => {
  it('creates an isolated child session and archives it', async () => {
    sessions.createSession({ key: 'parent' });
    const result = await orchestrator.spawn({
      task: 'find X',
      parentSessionKey: 'parent',
      profileId: 'search',
    });
    expect(result.ok).toBe(true);
    expect(result.summary).toBe('sub-agent done');
    expect(result.profileId).toBe('search');
    expect(result.childSessionKey).toMatch(/^subagent:parent:/);

    const child = sessions.getSession(result.childSessionKey);
    expect(child).not.toBeNull();
    expect(child?.kind).toBe('isolated');
    expect(child?.parentKey).toBe('parent');
    expect(child?.isArchived).toBe(true);
  });

  it("filters tools to the profile's allowlist", async () => {
    sessions.createSession({ key: 'parent' });
    await orchestrator.spawn({
      task: 'search the web',
      parentSessionKey: 'parent',
      profileId: 'search',
    });
    const call = generateContent.mock.calls[0]?.[0] as
      | { config?: { tools?: Array<{ functionDeclarations?: Array<{ name: string }> }> } }
      | undefined;
    const declarations = call?.config?.tools?.[0]?.functionDeclarations ?? [];
    const names = declarations.map((d) => d.name);
    expect(names).toContain('web_search');
    expect(names).not.toContain('shell'); // shell is not in search profile's allowlist
  });

  it('forks identity but does NOT pass parent message history', async () => {
    sessions.createSession({ key: 'parent' });
    sessions.appendMessage({ sessionKey: 'parent', role: 'user', content: 'parent secret' });
    sessions.appendMessage({ sessionKey: 'parent', role: 'assistant', content: 'parent reply' });

    await orchestrator.spawn({
      task: 'do thing',
      parentSessionKey: 'parent',
      profileId: 'communicator',
    });

    const call = generateContent.mock.calls[0]?.[0] as
      | { contents?: Array<{ parts?: Array<{ text?: string }> }> }
      | undefined;
    const transcript = JSON.stringify(call?.contents ?? []);
    expect(transcript).not.toContain('parent secret');
    expect(transcript).not.toContain('parent reply');
    expect(transcript).toContain('do thing');
  });

  it('renders goalChain into the system instruction', async () => {
    sessions.createSession({ key: 'parent' });
    await orchestrator.spawn({
      task: 'find Flutter 4 features',
      parentSessionKey: 'parent',
      profileId: 'researcher',
      goalChain: [
        'Help user prepare for talk',
        'Cover Flutter 4 announcements',
        'Find feature highlights',
      ],
    });

    const call = generateContent.mock.calls[0]?.[0] as { config?: { systemInstruction?: string } };
    const sys = call.config?.systemInstruction ?? '';
    expect(sys).toContain('Goal ancestry');
    expect(sys).toContain('Help user prepare for talk');
    expect(sys).toContain('Find feature highlights');
  });

  it('returns error result when sub-agent fails', async () => {
    generateContent.mockRejectedValue(new Error('boom'));
    sessions.createSession({ key: 'parent' });
    const result = await orchestrator.spawn({
      task: 't',
      parentSessionKey: 'parent',
      profileId: 'search',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('boom');
  });
});
