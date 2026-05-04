import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from './registry.js';
import type { AgentTool, ToolContext } from '../types/index.js';

const fakeCtx = {
  session: {
    key: 's1',
    kind: 'main',
    parentKey: null,
    channel: null,
    target: null,
    senderId: null,
    createdAt: 0,
    updatedAt: 0,
    lastMessageAt: null,
    model: 'gemini-2.5-flash',
    totalTokens: 0,
    isArchived: false,
  },
  workspacePath: '/tmp/x',
  config: {} as never,
} as unknown as ToolContext;

function tool(name: string, permission: AgentTool['permission'], result = 'ok'): AgentTool {
  return {
    name,
    description: `${name} tool`,
    permission,
    parameters: { type: 'object', description: '', properties: {}, required: [] },
    async execute() {
      return { success: true, result };
    },
  };
}

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const r = new ToolRegistry();
    const t = tool('filesystem', 'allow');
    r.register(t);
    expect(r.get('filesystem')).toBe(t);
    expect(r.list()).toHaveLength(1);
  });

  it('refuses duplicate registrations without override', () => {
    const r = new ToolRegistry();
    r.register(tool('a', 'allow'));
    expect(() => r.register(tool('a', 'allow'))).toThrow(/already registered/);
  });

  it('allows override when explicitly requested', () => {
    const r = new ToolRegistry();
    r.register(tool('a', 'allow', 'first'));
    r.register(tool('a', 'allow', 'second'), { override: true });
    expect(r.get('a')?.permission).toBe('allow');
  });

  it('execute returns error for unknown tool', async () => {
    const r = new ToolRegistry();
    const result = await r.execute('nope', {}, fakeCtx);
    expect(result.error).toMatch(/Unknown/);
  });

  it('execute refuses denied tools', async () => {
    const r = new ToolRegistry();
    r.register(tool('blocked', 'deny'));
    const result = await r.execute('blocked', {}, fakeCtx);
    expect(result.error).toMatch(/denied/);
  });

  it('execute calls approval gate for ask tools', async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const r = new ToolRegistry({ approvalGate: { approve } });
    r.register(tool('shell', 'ask'));
    const result = await r.execute('shell', { command: 'ls' }, fakeCtx);
    expect(result.success).toBe(true);
    expect(approve).toHaveBeenCalledOnce();
  });

  it('execute refuses ask tool when gate denies', async () => {
    const r = new ToolRegistry({ approvalGate: { approve: async () => false } });
    r.register(tool('shell', 'ask'));
    const result = await r.execute('shell', { command: 'ls' }, fakeCtx);
    expect(result.error).toMatch(/User denied/);
  });

  it('catches thrown errors from a tool', async () => {
    const r = new ToolRegistry();
    r.register({
      name: 'crashy',
      description: 'x',
      permission: 'allow',
      parameters: { type: 'object', description: '', properties: {}, required: [] },
      async execute() {
        throw new Error('boom');
      },
    });
    const result = await r.execute('crashy', {}, fakeCtx);
    expect(result.error).toMatch(/threw.*boom/);
  });

  it('toFunctionDeclarations exposes name + description + parameters', () => {
    const r = new ToolRegistry();
    r.register(tool('a', 'allow'));
    r.register(tool('b', 'allow'));
    const decls = r.toFunctionDeclarations();
    expect(decls).toHaveLength(2);
    expect(decls[0]).toHaveProperty('name');
    expect(decls[0]).toHaveProperty('description');
    expect(decls[0]).toHaveProperty('parameters');
  });
});
