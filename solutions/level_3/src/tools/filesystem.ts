// src/tools/filesystem.ts
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import type { AgentTool } from '../types/index.js';

// Confine every filesystem call to the workspace directory. Without this, a
// tool argument like `../../../etc/passwd` reaches outside the sandbox.
// See https://owasp.org/www-community/attacks/Path_Traversal.
function safePath(workspacePath: string, raw: string): string {
  const root = normalize(workspacePath);
  const target = normalize(resolve(root, raw));
  if (!target.startsWith(root)) {
    throw new Error(`Path traversal blocked: ${raw}`);
  }
  return target;
}

export const filesystemTool: AgentTool = {
  name: 'filesystem',
  description:
    'Read, write, or list files inside the workspace directory. Use for ' +
    'persistent notes, drafts, and reference files. Cannot reach outside the workspace.',
  permission: 'ask',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write', 'list'] },
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['action', 'path'],
  },
  async execute(args, ctx) {
    const action = String(args.action ?? '');
    const target = safePath(ctx.workspacePath, String(args.path ?? ''));

    if (action === 'read') {
      const text = await readFile(target, 'utf8');
      return { success: true, result: text };
    }
    if (action === 'write') {
      await mkdir(resolve(target, '..'), { recursive: true });
      const content = String(args.content ?? '');
      await writeFile(target, content, 'utf8');
      return { success: true, result: `Wrote ${content.length} bytes.` };
    }
    if (action === 'list') {
      const entries = await readdir(target, { withFileTypes: true });
      const lines = entries.map((e) => `${e.isDirectory() ? 'dir ' : 'file'}  ${e.name}`);
      return { success: true, result: lines.join('\n') || '(empty)' };
    }
    return { error: `Unknown action: ${action}` };
  },
};
