import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentTool } from '../types/index.js';

const execAsync = promisify(exec);

async function runCommand(
  cmd: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 30_000 });
    return { stdout, stderr, ok: true };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? String(err), ok: false };
  }
}

async function tryGeminiCli(prompt: string, cwd: string): Promise<string | null> {
  // fast existence check — avoids hang when gemini is not on PATH
  const which = await runCommand('which gemini', cwd);
  if (!which.ok) return null;
  // short timeout: gemini hanging (e.g. waiting for auth) should fail fast
  try {
    const { stdout } = await execAsync(`gemini -p ${JSON.stringify(prompt)}`, {
      cwd,
      timeout: 8_000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export function makeCodeFixTool(): AgentTool {
  return {
    name: 'code_fix',
    description: [
      'Resolve a coding issue by reading the broken file, optionally reproducing the error,',
      'generating a fix (via Gemini CLI if available, otherwise generating directly),',
      'applying the fix, and verifying it passes.',
      'Use this when the user reports an error in a specific file or test.',
    ].join(' '),
    permission: 'ask',
    parameters: {
      type: 'object',
      description: 'Code fix request',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to fix, relative to workspace root',
        },
        errorDescription: {
          type: 'string',
          description: 'The error message or description of the problem',
        },
        verifyCommand: {
          type: 'string',
          description:
            'Shell command to run to verify the fix worked (e.g. "npm test -- src/foo.test.ts"). Runs inside workspace.',
        },
        reproduceCommand: {
          type: 'string',
          description:
            'Shell command that reproduces the error. Used to confirm the issue before fixing.',
        },
      },
      required: ['filePath', 'errorDescription'],
    },
    async execute(args, ctx) {
      const relPath = String(args.filePath ?? '');
      const errorDesc = String(args.errorDescription ?? '');
      if (!relPath || !errorDesc) return { error: 'filePath and errorDescription are required' };

      const absPath = resolve(ctx.workspacePath, relPath);
      if (!absPath.startsWith(ctx.workspacePath)) {
        return { error: 'path traversal not allowed' };
      }

      let originalCode: string;
      try {
        originalCode = await readFile(absPath, 'utf8');
      } catch {
        return { error: `Cannot read ${relPath}` };
      }

      let reproduceOutput = '';
      if (args.reproduceCommand) {
        const rep = await runCommand(String(args.reproduceCommand), ctx.workspacePath);
        reproduceOutput = (rep.stderr || rep.stdout).slice(0, 2000);
      }

      const fixPrompt = [
        `File: ${relPath}`,
        `Error: ${errorDesc}`,
        reproduceOutput ? `Reproduction output:\n${reproduceOutput}` : '',
        `Current code:\n\`\`\`\n${originalCode.slice(0, 6000)}\n\`\`\``,
        'Output ONLY the corrected file contents, no explanation, no markdown fences.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const fixedCode = await tryGeminiCli(fixPrompt, ctx.workspacePath);

      if (!fixedCode) {
        return {
          success: false,
          result: `Gemini CLI not available. Proposed fix prompt (apply manually):\n\n${fixPrompt}`,
          requiresManualAction: true,
        };
      }

      await writeFile(absPath, fixedCode, 'utf8');

      if (!args.verifyCommand) {
        return {
          success: true,
          result: `Applied fix to ${relPath}. No verify command provided — please review the change.`,
          fixApplied: true,
        };
      }

      const verify = await runCommand(String(args.verifyCommand), ctx.workspacePath);
      if (verify.ok) {
        return {
          success: true,
          result: `Fixed and verified ${relPath}.\n\nVerify output:\n${verify.stdout.slice(0, 1000)}`,
          fixApplied: true,
          verified: true,
        };
      }

      // verification failed — restore original and report
      await writeFile(absPath, originalCode, 'utf8');
      return {
        success: false,
        result: `Fix attempt failed verification. Restored original.\n\nVerify error:\n${(verify.stderr || verify.stdout).slice(0, 1000)}`,
        fixApplied: false,
        verified: false,
      };
    },
  };
}
