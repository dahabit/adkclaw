import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeCodeFixTool } from './code-fix.js';
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
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-codefix-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('code_fix', () => {
  it('errors when filePath is missing', async () => {
    const tool = makeCodeFixTool();
    const r = await tool.execute({ errorDescription: 'broken' }, ctx());
    expect(r.error).toBeDefined();
  });

  it('errors when errorDescription is missing', async () => {
    const tool = makeCodeFixTool();
    const r = await tool.execute({ filePath: 'foo.ts' }, ctx());
    expect(r.error).toBeDefined();
  });

  it('errors when file does not exist', async () => {
    const tool = makeCodeFixTool();
    const r = await tool.execute({ filePath: 'nonexistent.ts', errorDescription: 'error' }, ctx());
    expect(r.error).toMatch(/Cannot read/);
  });

  it('blocks path traversal', async () => {
    const tool = makeCodeFixTool();
    const r = await tool.execute({ filePath: '../../etc/passwd', errorDescription: 'test' }, ctx());
    expect(r.error).toMatch(/path traversal/);
  });

  it('returns a result object (not throws) for a readable file', async () => {
    const file = join(workspace, 'broken.ts');
    writeFileSync(file, 'const x: number = "wrong";', 'utf8');
    const tool = makeCodeFixTool();
    // May call gemini or fall back — either way must not throw and must return result
    const r = await tool.execute({ filePath: 'broken.ts', errorDescription: 'Type error' }, ctx());
    expect(r.error).toBeUndefined();
    expect(r.result).toBeDefined();
  }, 12_000);
});
