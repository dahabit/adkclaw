import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filesystemTool } from './filesystem.js';
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

describe('filesystemTool', () => {
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'adkclaw-fs-'));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('reads existing files', async () => {
    writeFileSync(join(workspace, 'hello.txt'), 'world');
    const r = await filesystemTool.execute({ operation: 'read', path: 'hello.txt' }, makeCtx());
    expect(r.success).toBe(true);
    expect(r.result).toBe('world');
  });

  it('writes files (creating parent dirs)', async () => {
    const r = await filesystemTool.execute(
      { operation: 'write', path: 'nested/dir/note.md', content: '# hi' },
      makeCtx(),
    );
    expect(r.success).toBe(true);
    const back = await filesystemTool.execute(
      { operation: 'read', path: 'nested/dir/note.md' },
      makeCtx(),
    );
    expect(back.result).toBe('# hi');
  });

  it('lists a directory', async () => {
    mkdirSync(join(workspace, 'sub'));
    writeFileSync(join(workspace, 'a.txt'), 'a');
    writeFileSync(join(workspace, 'b.txt'), 'b');
    const r = await filesystemTool.execute({ operation: 'list', path: '.' }, makeCtx());
    expect(r.success).toBe(true);
    expect(r.result).toContain('a.txt');
    expect(r.result).toContain('b.txt');
    expect(r.result).toContain('sub/');
  });

  it('rejects path traversal escape attempts', async () => {
    const r = await filesystemTool.execute(
      { operation: 'read', path: '../../../etc/passwd' },
      makeCtx(),
    );
    expect(r.error).toMatch(/escapes workspace root/);
  });

  it('rejects absolute paths outside workspace', async () => {
    const r = await filesystemTool.execute({ operation: 'read', path: '/etc/passwd' }, makeCtx());
    expect(r.error).toMatch(/escapes workspace root/);
  });

  it('returns error for unknown operation', async () => {
    const r = await filesystemTool.execute({ operation: 'append', path: 'x' }, makeCtx());
    expect(r.error).toMatch(/Unknown operation/);
  });

  it('returns error when content missing on write', async () => {
    const r = await filesystemTool.execute({ operation: 'write', path: 'x.txt' }, makeCtx());
    expect(r.error).toMatch(/content must be a string/);
  });
});
