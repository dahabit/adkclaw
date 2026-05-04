import { spawn } from 'node:child_process';
import type { AgentTool, ToolResult } from '../types/index.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_OUTPUT = 50_000;

export const shellTool: AgentTool = {
  name: 'shell',
  description:
    'Execute a shell command in the agent workspace and return stdout, stderr, and the exit code. Permission is "ask" — the user must approve destructive operations. Use sparingly: prefer filesystem and dedicated tools for routine work.',
  permission: 'ask',
  parameters: {
    type: 'object',
    description: 'Shell command arguments',
    properties: {
      command: {
        type: 'string',
        description: 'A single command line, run via /bin/sh -c. Cwd = workspace root.',
      },
      timeoutMs: {
        type: 'integer',
        description: 'Timeout in milliseconds (default 30000, max 120000)',
      },
    },
    required: ['command'],
  },
  async execute(args, ctx) {
    const command = String(args.command ?? '');
    if (!command) return { error: 'command is required' };
    const timeoutMs = Math.min(
      Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );

    return new Promise<ToolResult>((resolveResult) => {
      const child = spawn('/bin/sh', ['-c', command], {
        cwd: ctx.workspacePath,
        env: { ...process.env },
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (d) => {
        stdout += String(d);
        if (stdout.length > MAX_OUTPUT) stdout = stdout.slice(0, MAX_OUTPUT) + '\n[truncated]';
      });
      child.stderr.on('data', (d) => {
        stderr += String(d);
        if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(0, MAX_OUTPUT) + '\n[truncated]';
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolveResult({ error: err.message });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          resolveResult({ error: `Command timed out after ${timeoutMs}ms` });
          return;
        }
        const result = `exit ${code}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`;
        resolveResult({ success: code === 0, result });
      });
    });
  },
};
