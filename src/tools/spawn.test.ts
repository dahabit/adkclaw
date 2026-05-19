import { describe, it, expect, vi } from 'vitest';
import {
  makeSpawnAgentTool,
  makeSpawnSearchTool,
  makeSpawnCommunicatorTool,
  makeSpawnResearcherTool,
  makeSpawnCoderTool,
} from './spawn.js';
import type { MultiAgentOrchestrator } from '../multi-agent/orchestrator.js';
import type { ToolContext } from '../types/index.js';

const ctx: ToolContext = {
  session: {
    key: 'parent:session',
    kind: 'main',
    parentKey: null,
    channel: null,
    target: null,
    senderId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: null,
    model: 'gemini-3.1-pro-preview',
    totalTokens: 0,
    isArchived: false,
  },
  workspacePath: '/tmp/ws',
  config: {} as never,
};

function mockOrchestrator(): MultiAgentOrchestrator {
  return {
    spawn: vi.fn().mockResolvedValue({
      ok: true,
      profileId: 'coder',
      toolCalls: 5,
      tokensUsed: 1000,
      durationMs: 2500,
      summary: 'Task completed successfully',
    }),
  } as unknown as MultiAgentOrchestrator;
}

describe('spawn_agent tool', () => {
  it('has correct metadata', () => {
    const tool = makeSpawnAgentTool(mockOrchestrator());
    expect(tool.name).toBe('spawn_agent');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('sub-agent');
    expect(tool.parameters.required).toEqual(['task']);
  });

  it('spawns an agent with required task', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnAgentTool(orchestrator);
    const result = await tool.execute(
      {
        task: 'Review the code',
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.result).toContain('finished');
    expect(orchestrator.spawn).toHaveBeenCalledWith({
      task: 'Review the code',
      parentSessionKey: 'parent:session',
    });
  });

  it('includes profile id when specified', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnAgentTool(orchestrator);
    await tool.execute(
      {
        task: 'Search for information',
        profileId: 'search',
      },
      ctx,
    );
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.profileId).toBe('search');
  });

  it('includes goal chain when specified', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnAgentTool(orchestrator);
    const goals = ['Analyze the problem', 'Find the solution', 'Implement'];
    await tool.execute(
      {
        task: 'Final task',
        goalChain: goals,
      },
      ctx,
    );
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.goalChain).toEqual(goals);
  });

  it('rejects missing task', async () => {
    const tool = makeSpawnAgentTool(mockOrchestrator());
    const result = await tool.execute({}, ctx);
    expect(result.error).toContain('task is required');
  });

  it('formats success result with metadata', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnAgentTool(orchestrator);
    const result = await tool.execute({ task: 'Do something' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('5 tools');
    expect(result.result).toContain('1000 tokens');
    expect(result.result).toContain('2500ms');
  });

  it('handles spawn failure', async () => {
    const orchestrator = mockOrchestrator();
    (orchestrator.spawn as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      profileId: 'search',
      error: 'Search failed',
    });
    const tool = makeSpawnAgentTool(orchestrator);
    const result = await tool.execute({ task: 'Search' }, ctx);
    expect(result.error).toContain('failed');
    expect(result.error).toContain('Search failed');
  });

  it('describes available profiles', () => {
    const tool = makeSpawnAgentTool(mockOrchestrator());
    expect(tool.description).toContain('Available profiles:');
    // Should mention specific profiles
    expect(tool.description).toMatch(/search|coder|researcher/);
  });
});

describe('spawn_search tool', () => {
  it('has correct name and metadata', () => {
    const tool = makeSpawnSearchTool(mockOrchestrator());
    expect(tool.name).toBe('spawn_search');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('search');
  });

  it('spawns with search profile', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnSearchTool(orchestrator);
    await tool.execute({ task: 'Find info' }, ctx);
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.profileId).toBe('search');
  });

  it('rejects missing task', async () => {
    const tool = makeSpawnSearchTool(mockOrchestrator());
    const result = await tool.execute({}, ctx);
    expect(result.error).toBeDefined();
  });

  it('accepts optional goal chain', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnSearchTool(orchestrator);
    await tool.execute(
      {
        task: 'Search',
        goalChain: ['Step 1', 'Step 2'],
      },
      ctx,
    );
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.goalChain).toEqual(['Step 1', 'Step 2']);
  });
});

describe('spawn_communicator tool', () => {
  it('has correct name and metadata', () => {
    const tool = makeSpawnCommunicatorTool(mockOrchestrator());
    expect(tool.name).toBe('spawn_communicator');
    expect(tool.permission).toBe('allow');
  });

  it('spawns with communicator profile', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnCommunicatorTool(orchestrator);
    await tool.execute({ task: 'Draft email' }, ctx);
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.profileId).toBe('communicator');
  });
});

describe('spawn_researcher tool', () => {
  it('has correct name and metadata', () => {
    const tool = makeSpawnResearcherTool(mockOrchestrator());
    expect(tool.name).toBe('spawn_researcher');
    expect(tool.permission).toBe('allow');
  });

  it('spawns with researcher profile', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnResearcherTool(orchestrator);
    await tool.execute({ task: 'Research topic' }, ctx);
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.profileId).toBe('researcher');
  });
});

describe('spawn_coder tool', () => {
  it('has correct name and metadata', () => {
    const tool = makeSpawnCoderTool(mockOrchestrator());
    expect(tool.name).toBe('spawn_coder');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('coder');
  });

  it('spawns with coder profile', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnCoderTool(orchestrator);
    await tool.execute({ task: 'Write code' }, ctx);
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.profileId).toBe('coder');
  });

  it('includes parent session key in spawn call', async () => {
    const orchestrator = mockOrchestrator();
    const tool = makeSpawnCoderTool(orchestrator);
    await tool.execute({ task: 'Do something' }, ctx);
    const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.parentSessionKey).toBe('parent:session');
  });

  it('propagates orchestrator errors to the caller', async () => {
    const orchestrator = mockOrchestrator();
    (orchestrator.spawn as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Orchestrator error'),
    );
    const tool = makeSpawnCoderTool(orchestrator);
    await expect(tool.execute({ task: 'Task' }, ctx)).rejects.toThrow('Orchestrator error');
  });
});

describe('profile spawn tools general', () => {
  it('all profile tools pass task through to orchestrator', async () => {
    const orchestrator = mockOrchestrator();
    const tools = [
      makeSpawnSearchTool(orchestrator),
      makeSpawnCommunicatorTool(orchestrator),
      makeSpawnResearcherTool(orchestrator),
      makeSpawnCoderTool(orchestrator),
    ];

    for (const tool of tools) {
      (orchestrator.spawn as ReturnType<typeof vi.fn>).mockClear();
      await tool.execute({ task: 'Test task' }, ctx);
      const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(call.task).toBe('Test task');
    }
  });

  it('all profile tools include parent session key', async () => {
    const orchestrator = mockOrchestrator();
    const tools = [
      makeSpawnSearchTool(orchestrator),
      makeSpawnCommunicatorTool(orchestrator),
      makeSpawnResearcherTool(orchestrator),
      makeSpawnCoderTool(orchestrator),
    ];

    for (const tool of tools) {
      (orchestrator.spawn as ReturnType<typeof vi.fn>).mockClear();
      await tool.execute({ task: 'Test' }, ctx);
      const call = (orchestrator.spawn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(call.parentSessionKey).toBe('parent:session');
    }
  });
});
