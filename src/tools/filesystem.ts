import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { isAbsolute, normalize, relative, resolve } from 'node:path';
import type { AgentTool } from '../types/index.js';

function ensureInsideRoot(root: string, requested: string): string {
  const target = isAbsolute(requested) ? requested : resolve(root, requested);
  const normalized = normalize(target);
  const rootNormalized = normalize(root);
  const rel = relative(rootNormalized, normalized);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path escapes workspace root: ${requested}`);
  }
  return normalized;
}

export const filesystemTool: AgentTool = {
  name: 'filesystem',
  description:
    'Read, write, or list files inside the agent workspace. Operation must be one of read, write, list. Path is relative to the workspace root. Use this to inspect or modify files the agent has access to.',
  permission: 'allow',
  parameters: {
    type: 'object',
    description: 'Filesystem operation',
    properties: {
      operation: {
        type: 'string',
        description: 'read | write | list',
        enum: ['read', 'write', 'list'],
      },
      path: { type: 'string', description: 'Path relative to the workspace root' },
      content: {
        type: 'string',
        description: 'Content to write (only used when operation=write)',
      },
    },
    required: ['operation', 'path'],
  },
  async execute(args, ctx) {
    const operation = String(args.operation ?? '').toLowerCase();
    const requestedPath = String(args.path ?? '');
    if (!requestedPath) return { error: 'path is required' };

    let absolute: string;
    try {
      absolute = ensureInsideRoot(ctx.workspacePath, requestedPath);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }

    try {
      if (operation === 'read') {
        const content = readFileSync(absolute, 'utf8');
        return { success: true, result: content };
      }
      if (operation === 'write') {
        const content = args.content;
        if (typeof content !== 'string') {
          return { error: 'content must be a string for write' };
        }
        mkdirSync(resolve(absolute, '..'), { recursive: true });
        writeFileSync(absolute, content, 'utf8');
        return {
          success: true,
          result: `Wrote ${content.length} chars to ${requestedPath}`,
        };
      }
      if (operation === 'list') {
        const stat = statSync(absolute);
        if (!stat.isDirectory()) {
          return { success: true, result: `${requestedPath} (file)` };
        }
        const entries = readdirSync(absolute, { withFileTypes: true })
          .map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`)
          .sort();
        return { success: true, result: entries.join('\n') || '(empty directory)' };
      }
      return { error: `Unknown operation: ${operation}` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  },
};
