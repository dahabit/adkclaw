// src/context/manager.ts
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const CORE_FILES = ['IDENTITY.md', 'USER.md', 'SOUL.md', 'AGENTS.md', 'MEMORY.md'];

export class ContextEngine {
  private cache: { fingerprint: string; prompt: string } | null = null;

  constructor(private readonly workspacePath: string) {}

  //REPLACE-CONTEXT-BOOTSTRAP
  bootstrap(): string {
    // Load personality files from workspace (SOUL.md, IDENTITY.md, etc),
    // cache the result by fingerprint, and return as the system prompt.
    // Fill this in from level_2/codelab.md §5.
    throw new Error('REPLACE-CONTEXT-BOOTSTRAP not implemented — see level_2/codelab.md §5');
  }

  // The mtime fingerprint means editing a workspace file invalidates the
  // cache on the next turn — no daemon restart needed.
  private computeFingerprint(): string {
    const parts: string[] = [];
    for (const file of CORE_FILES) {
      const path = resolve(this.workspacePath, file);
      if (!existsSync(path)) continue;
      parts.push(`${file}:${statSync(path).mtimeMs}`);
    }
    return parts.join('|');
  }
}
