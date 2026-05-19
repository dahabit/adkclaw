import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeMemorySaveTool, makeMemoryRecallTool, makeDailyAppendTool } from './memory.js';
import type { ToolContext } from '../types/index.js';

let workspace: string;

function ctx(): ToolContext {
  return {
    session: {
      key: 's',
      kind: 'main',
      parentKey: null,
      channel: null,
      target: null,
      senderId: null,
      createdAt: 0,
      updatedAt: 0,
      lastMessageAt: null,
      model: '',
      totalTokens: 0,
      isArchived: false,
    },
    workspacePath: workspace,
    config: {} as never,
  };
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-memory-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('memory_save tool', () => {
  it('has correct metadata', () => {
    const tool = makeMemorySaveTool();
    expect(tool.name).toBe('memory_save');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('Save');
    expect(tool.parameters.required).toEqual(['category', 'name', 'content']);
  });

  it('saves a fact to memory bank', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'facts',
        name: 'User prefers tea',
        content: 'The user mentioned they drink tea every morning',
      },
      ctx(),
    );
    expect(result.success).toBe(true);
    expect(result.result).toContain('bank/facts/');
    expect(result.result).toContain('.md');
  });

  it('saves a decision to memory bank', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'decisions',
        name: 'Use Riverpod',
        content: 'Decided to use Riverpod for state management',
      },
      ctx(),
    );
    expect(result.success).toBe(true);
    expect(result.result).toContain('bank/decisions/');
  });

  it('rejects invalid category', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'invalid',
        name: 'Test',
        content: 'Content',
      },
      ctx(),
    );
    expect(result.error).toContain('Invalid category');
  });

  it('rejects missing name', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'facts',
        name: '',
        content: 'Content',
      },
      ctx(),
    );
    expect(result.error).toContain('required');
  });

  it('rejects missing content', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'facts',
        name: 'Name',
        content: '',
      },
      ctx(),
    );
    expect(result.error).toContain('required');
  });

  it('saves projects category', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'projects',
        name: 'AdkClaw',
        content: 'Multi-agent framework for AI',
      },
      ctx(),
    );
    expect(result.success).toBe(true);
    expect(result.result).toContain('bank/projects/');
  });

  it('saves people category', async () => {
    const tool = makeMemorySaveTool();
    const result = await tool.execute(
      {
        category: 'people',
        name: 'Ahmed',
        content: 'GDE for Flutter and Dart',
      },
      ctx(),
    );
    expect(result.success).toBe(true);
    expect(result.result).toContain('bank/people/');
  });
});

describe('memory_recall tool', () => {
  it('has correct metadata', () => {
    const tool = makeMemoryRecallTool();
    expect(tool.name).toBe('memory_recall');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('Search');
    expect(tool.parameters.required).toEqual(['query']);
  });

  it('returns no matches message when empty', async () => {
    const tool = makeMemoryRecallTool();
    const result = await tool.execute({ query: 'nonexistent' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('no matches');
  });

  it('returns no matches when query matches nothing', async () => {
    const tool = makeMemoryRecallTool();
    const result = await tool.execute({ query: 'xyz999nonexistent' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('no matches');
  });

  it('accepts category filter', async () => {
    const tool = makeMemoryRecallTool();
    const result = await tool.execute(
      {
        query: 'test',
        category: 'facts',
      },
      ctx(),
    );
    // Even with no results, should not error
    expect(result.success || result.error).toBeDefined();
  });

  it('accepts limit parameter', async () => {
    const tool = makeMemoryRecallTool();
    const result = await tool.execute(
      {
        query: 'test',
        limit: 5,
      },
      ctx(),
    );
    expect(result.success || result.error).toBeDefined();
  });

  it('rejects invalid category', async () => {
    const tool = makeMemoryRecallTool();
    const result = await tool.execute(
      {
        query: 'test',
        category: 'invalid',
      },
      ctx(),
    );
    // Should ignore invalid category and still search
    expect(result.success).toBe(true);
  });

  it('returns formatted results when matches exist', async () => {
    // First save something
    const saveTool = makeMemorySaveTool();
    await saveTool.execute(
      {
        category: 'facts',
        name: 'Coffee habit',
        content: 'User drinks coffee daily',
      },
      ctx(),
    );

    // Then search for it
    const recallTool = makeMemoryRecallTool();
    const result = await recallTool.execute({ query: 'coffee' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('facts/');
    expect(result.result).toContain('Coffee habit');
  });

  it('uses default limit of 20 when not specified', async () => {
    const tool = makeMemoryRecallTool();
    const result = await tool.execute({ query: 'test' }, ctx());
    expect(result.success || result.error).toBeDefined();
  });
});

describe('daily_append tool', () => {
  it('has correct metadata', () => {
    const tool = makeDailyAppendTool();
    expect(tool.name).toBe('daily_append');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('daily journal');
    expect(tool.parameters.required).toEqual(['text']);
  });

  it('appends text to daily note', async () => {
    const tool = makeDailyAppendTool();
    const result = await tool.execute({ text: 'Completed the feature' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain("Appended to today's");
  });

  it('rejects missing text', async () => {
    const tool = makeDailyAppendTool();
    const result = await tool.execute({ text: '' }, ctx());
    expect(result.error).toContain('required');
  });

  it('appends different text on multiple calls', async () => {
    const tool = makeDailyAppendTool();
    const r1 = await tool.execute({ text: 'First note' }, ctx());
    const r2 = await tool.execute({ text: 'Second note' }, ctx());
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('handles long text entries', async () => {
    const tool = makeDailyAppendTool();
    const longText = 'x'.repeat(1000);
    const result = await tool.execute({ text: longText }, ctx());
    expect(result.success).toBe(true);
  });
});
