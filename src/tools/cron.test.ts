import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeCronAddTool,
  makeCronRemoveTool,
  makeCronListTool,
  makeMessageUserTool,
} from './cron.js';
import type { CronEngine } from '../cron/engine.js';
import type { ToolContext, Session } from '../types/index.js';

const fakeSession: Session = {
  key: 'test:session',
  kind: 'main',
  parentKey: null,
  channel: 'cli',
  target: 'test',
  senderId: 'test',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastMessageAt: null,
  model: 'gemini-3.1-pro-preview',
  totalTokens: 0,
  isArchived: false,
};

const ctx: ToolContext = {
  session: fakeSession,
  workspacePath: '/tmp/ws',
  config: {} as never,
};

const ctxNoChannel: ToolContext = {
  session: { ...fakeSession, channel: null, target: null },
  workspacePath: '/tmp/ws',
  config: {} as never,
};

function mockEngine(): CronEngine {
  return {
    add: vi.fn().mockReturnValue({
      id: 'job-1',
      name: 'Test Job',
      schedule: '0 9 * * *',
    }),
    remove: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  } as unknown as CronEngine;
}

describe('cron_add tool', () => {
  it('has correct metadata', () => {
    const tool = makeCronAddTool(mockEngine());
    expect(tool.name).toBe('cron_add');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('recurring');
    expect(tool.parameters.required).toEqual(['name', 'schedule', 'task']);
  });

  it('schedules a job with valid args', async () => {
    const engine = mockEngine();
    const tool = makeCronAddTool(engine);
    const result = await tool.execute(
      {
        name: 'Daily Check',
        schedule: '0 9 * * *',
        task: 'check the logs',
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.result).toContain('Scheduled job');
    expect(engine.add).toHaveBeenCalledWith({
      name: 'Daily Check',
      schedule: '0 9 * * *',
      task: 'check the logs',
      sessionKey: 'test:session',
      channel: 'cli',
      target: 'test',
    });
  });

  it('rejects missing name', async () => {
    const tool = makeCronAddTool(mockEngine());
    const result = await tool.execute(
      {
        schedule: '0 9 * * *',
        task: 'do something',
      },
      ctx,
    );
    expect(result.error).toContain('required');
  });

  it('rejects missing schedule', async () => {
    const tool = makeCronAddTool(mockEngine());
    const result = await tool.execute(
      {
        name: 'Test',
        task: 'do something',
      },
      ctx,
    );
    expect(result.error).toContain('required');
  });

  it('rejects missing task', async () => {
    const tool = makeCronAddTool(mockEngine());
    const result = await tool.execute(
      {
        name: 'Test',
        schedule: '0 9 * * *',
      },
      ctx,
    );
    expect(result.error).toContain('required');
  });

  it('handles engine errors', async () => {
    const engine = mockEngine();
    (engine.add as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Invalid cron expression');
    });
    const tool = makeCronAddTool(engine);
    const result = await tool.execute(
      {
        name: 'Bad Job',
        schedule: 'invalid',
        task: 'test',
      },
      ctx,
    );
    expect(result.error).toContain('Invalid cron expression');
  });

  it('omits channel/target when not present in session', async () => {
    const engine = mockEngine();
    const tool = makeCronAddTool(engine);
    const sessionNoMeta: ToolContext = {
      ...ctx,
      session: { ...fakeSession, channel: null, target: null },
    };
    await tool.execute(
      {
        name: 'Test',
        schedule: '0 9 * * *',
        task: 'task',
      },
      sessionNoMeta,
    );
    const call = (engine.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call.channel).toBeUndefined();
    expect(call.target).toBeUndefined();
  });
});

describe('cron_remove tool', () => {
  it('has correct metadata', () => {
    const tool = makeCronRemoveTool(mockEngine());
    expect(tool.name).toBe('cron_remove');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('Delete');
  });

  it('removes a job by id', async () => {
    const engine = mockEngine();
    const tool = makeCronRemoveTool(engine);
    const result = await tool.execute({ id: 'job-123' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('Removed');
    expect(engine.remove).toHaveBeenCalledWith('job-123');
  });

  it('rejects missing id', async () => {
    const tool = makeCronRemoveTool(mockEngine());
    const result = await tool.execute({}, ctx);
    expect(result.error).toContain('required');
  });

  it('handles engine errors on removal', async () => {
    const engine = mockEngine();
    (engine.remove as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Job not found');
    });
    const tool = makeCronRemoveTool(engine);
    const result = await tool.execute({ id: 'nonexistent' }, ctx);
    expect(result.error).toContain('Job not found');
  });
});

describe('cron_list tool', () => {
  it('has correct metadata', () => {
    const tool = makeCronListTool(mockEngine());
    expect(tool.name).toBe('cron_list');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('List');
  });

  it('returns empty message when no jobs', async () => {
    const tool = makeCronListTool(mockEngine());
    const result = await tool.execute({}, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('no scheduled jobs');
  });

  it('formats and lists jobs', async () => {
    const engine = mockEngine();
    (engine.list as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        id: 'job-1',
        name: 'Morning Check',
        schedule: '0 9 * * *',
        enabled: true,
        task: 'check logs and report',
        lastRunAt: 1234567890,
      },
      {
        id: 'job-2',
        name: 'Disabled Job',
        schedule: '0 12 * * *',
        enabled: false,
        task: 'this is a task',
        lastRunAt: null,
      },
    ]);
    const tool = makeCronListTool(engine);
    const result = await tool.execute({}, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('job-1');
    expect(result.result).toContain('Morning Check');
    expect(result.result).toContain('0 9 * * *');
    expect(result.result).toContain('✓');
    expect(result.result).toContain('✗');
    expect(result.result).toContain('never');
  });
});

describe('message_user tool', () => {
  it('has correct metadata', () => {
    const tool = makeMessageUserTool(() => Promise.resolve());
    expect(tool.name).toBe('message_user');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('message');
  });

  it('delivers a message when delivery fn present', async () => {
    const deliveryFn = vi.fn().mockResolvedValue(undefined);
    const tool = makeMessageUserTool(deliveryFn);
    const result = await tool.execute({ text: 'Hello user' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('Delivered');
    expect(deliveryFn).toHaveBeenCalledWith('cli', 'test', 'Hello user');
  });

  it('rejects missing text', async () => {
    const tool = makeMessageUserTool(() => Promise.resolve());
    const result = await tool.execute({}, ctx);
    expect(result.error).toContain('required');
  });

  it('errors when no delivery fn configured', async () => {
    const tool = makeMessageUserTool(null);
    const result = await tool.execute({ text: 'Hello' }, ctx);
    expect(result.error).toContain('no delivery channel');
  });

  it('errors when session has no channel', async () => {
    const tool = makeMessageUserTool(() => Promise.resolve());
    const result = await tool.execute({ text: 'Hello' }, ctxNoChannel);
    expect(result.error).toContain('no channel/target');
  });

  it('handles delivery errors', async () => {
    const deliveryFn = vi.fn().mockRejectedValue(new Error('Delivery failed'));
    const tool = makeMessageUserTool(deliveryFn);
    const result = await tool.execute({ text: 'Test' }, ctx);
    expect(result.error).toContain('Delivery failed');
  });

  it('reports message length in result', async () => {
    const deliveryFn = vi.fn().mockResolvedValue(undefined);
    const tool = makeMessageUserTool(deliveryFn);
    const longText = 'x'.repeat(100);
    const result = await tool.execute({ text: longText }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('100 chars');
  });
});
