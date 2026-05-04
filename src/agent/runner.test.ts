import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GoogleGenAI } from '@google/genai';
import { AgentRunner } from './runner.js';
import { SessionStore } from '../sessions/store.js';
import { ContextEngine } from '../context/manager.js';
import { ToolRegistry } from '../tools/registry.js';
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

interface FakeResponse {
  candidates?: Array<{ content?: { parts?: unknown[] } }>;
  usageMetadata?: { totalTokenCount?: number };
}

function makeRunner(responses: FakeResponse[]) {
  const workspace = mkdtempSync(join(tmpdir(), 'adkclaw-runner-'));
  const sessions = new SessionStore({ databasePath: ':memory:' });
  const contextEngine = new ContextEngine({ workspacePath: workspace });
  const registry = new ToolRegistry();
  const config = makeConfig(workspace);

  let i = 0;
  const generateContent = vi.fn().mockImplementation(async () => {
    const r = responses[i] ?? responses[responses.length - 1];
    i += 1;
    return r;
  });
  const fakeClient = {
    models: { generateContent },
  } as unknown as GoogleGenAI;

  const runner = new AgentRunner({
    client: fakeClient,
    sessions,
    contextEngine,
    registry,
    config,
  });
  return { runner, sessions, registry, generateContent, workspace };
}

let workspaces: string[] = [];

beforeEach(() => {
  workspaces = [];
});

afterEach(() => {
  for (const w of workspaces) rmSync(w, { recursive: true, force: true });
});

describe('AgentRunner', () => {
  it('returns text on a simple non-tool turn', async () => {
    const { runner, sessions, workspace } = makeRunner([
      {
        candidates: [{ content: { parts: [{ text: 'Hello!' }] } }],
        usageMetadata: { totalTokenCount: 10 },
      },
    ]);
    workspaces.push(workspace);

    const r = await runner.run({ sessionKey: 'cli:1', message: 'hi' });
    expect(r.text).toBe('Hello!');
    expect(r.finishReason).toBe('completed');
    expect(r.toolCallCount).toBe(0);
    expect(r.tokensUsed).toBe(10);
    const msgs = sessions.listMessages('cli:1');
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(msgs[1]?.content).toBe('Hello!');
  });

  it('executes a tool call then returns final text', async () => {
    const { runner, sessions, registry, workspace } = makeRunner([
      {
        candidates: [
          {
            content: {
              parts: [{ functionCall: { name: 'echo', args: { message: 'hi' } } }],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 5 },
      },
      {
        candidates: [{ content: { parts: [{ text: 'done' }] } }],
        usageMetadata: { totalTokenCount: 5 },
      },
    ]);
    workspaces.push(workspace);

    registry.register({
      name: 'echo',
      description: 'echo input',
      permission: 'allow',
      parameters: {
        type: 'object',
        description: '',
        properties: { message: { type: 'string', description: '' } },
        required: ['message'],
      },
      async execute(args) {
        return { success: true, result: String(args.message) };
      },
    });

    const r = await runner.run({ sessionKey: 'k', message: 'pls echo' });
    expect(r.text).toBe('done');
    expect(r.toolCallCount).toBe(1);
    expect(r.tokensUsed).toBe(10);
    const roles = sessions.listMessages('k').map((m) => m.role);
    expect(roles).toEqual(['user', 'tool', 'assistant']);
  });

  it('caps at maxToolRounds and reports max_rounds', async () => {
    const toolCallResponse: FakeResponse = {
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: 'echo', args: {} } }],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 1 },
    };
    const { runner, registry, workspace } = makeRunner(Array(10).fill(toolCallResponse));
    workspaces.push(workspace);

    registry.register({
      name: 'echo',
      description: 'x',
      permission: 'allow',
      parameters: { type: 'object', description: '', properties: {}, required: [] },
      async execute() {
        return { success: true, result: 'ok' };
      },
    });

    const r = await runner.run({ sessionKey: 'k', message: 'loop forever' });
    expect(r.finishReason).toBe('max_rounds');
    expect(r.toolCallCount).toBeGreaterThan(0);
    expect(r.toolCallCount).toBeLessThanOrEqual(5);
  });

  it('reports error finishReason when SDK throws', async () => {
    const { runner, workspace } = makeRunner([{}]);
    workspaces.push(workspace);
    type ClientWithModels = {
      models: { generateContent: ReturnType<typeof vi.fn> };
    };
    (runner as unknown as { client: ClientWithModels }).client.models.generateContent = vi
      .fn()
      .mockRejectedValue(new Error('boom'));
    const r = await runner.run({ sessionKey: 'k', message: 'x' });
    expect(r.finishReason).toBe('error');
    expect(r.error).toContain('boom');
  });

  it('fires beforeTurn / afterTurn / beforeTool / afterTool callbacks', async () => {
    const { runner, registry, workspace } = makeRunner([
      {
        candidates: [
          {
            content: {
              parts: [{ functionCall: { name: 'noop', args: {} } }],
            },
          },
        ],
      },
      { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
    ]);
    workspaces.push(workspace);
    registry.register({
      name: 'noop',
      description: '',
      permission: 'allow',
      parameters: { type: 'object', description: '', properties: {}, required: [] },
      async execute() {
        return { success: true, result: '' };
      },
    });

    const beforeTurn = vi.fn();
    const afterTurn = vi.fn();
    const beforeTool = vi.fn();
    const afterTool = vi.fn();
    type RunnerCallbacks = { callbacks: Record<string, ReturnType<typeof vi.fn>> };
    (runner as unknown as RunnerCallbacks).callbacks = {
      beforeTurn,
      afterTurn,
      beforeTool,
      afterTool,
    };

    await runner.run({ sessionKey: 'k', message: 'x' });
    expect(beforeTurn).toHaveBeenCalledOnce();
    expect(afterTurn).toHaveBeenCalledOnce();
    expect(beforeTool).toHaveBeenCalledOnce();
    expect(afterTool).toHaveBeenCalledOnce();
  });
});
