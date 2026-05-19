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
  //REPLACE-TOOL-FILESYSTEM
  // Implement read, write, and list operations on files in the workspace,
  // using safePath() to prevent directory traversal attacks.
  // Fill this in from level_1/codelab.md §4.
  async execute(args, ctx) {
    throw new Error('REPLACE-TOOL-FILESYSTEM not implemented — see level_1/codelab.md §4');
  },
};
