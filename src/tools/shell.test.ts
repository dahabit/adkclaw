import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shellTool } from './shell.js';
import type { ToolContext } from '../types/index.js';

let workspace: string;

function makeCtx(): ToolContext {
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

describe('shellTool', () => {
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'adkclaw-sh-'));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('runs a command and captures stdout', async () => {
    const r = await shellTool.execute({ command: 'echo hello' }, makeCtx());
    expect(r.success).toBe(true);
    expect(r.result).toContain('exit 0');
    expect(r.result).toContain('hello');
  });

  it('reports non-zero exit codes', async () => {
    const r = await shellTool.execute({ command: 'false' }, makeCtx());
    expect(r.success).toBe(false);
    expect(r.result).toContain('exit 1');
  });

  it('runs in workspace cwd', async () => {
    const r = await shellTool.execute({ command: 'pwd' }, makeCtx());
    expect(r.result).toContain(workspace);
  });

  it('rejects empty command', async () => {
    const r = await shellTool.execute({ command: '' }, makeCtx());
    expect(r.error).toMatch(/command is required/);
  });

  it('honors timeout', async () => {
    const r = await shellTool.execute({ command: 'sleep 5', timeoutMs: 200 }, makeCtx());
    expect(r.error).toMatch(/timed out/);
  });
});
