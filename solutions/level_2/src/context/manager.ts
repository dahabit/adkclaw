// src/context/manager.ts
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const CORE_FILES = ['IDENTITY.md', 'USER.md', 'SOUL.md', 'AGENTS.md', 'MEMORY.md'];

export class ContextEngine {
  private cache: { fingerprint: string; prompt: string } | null = null;

  constructor(private readonly workspacePath: string) {}

  bootstrap(): string {
    const fingerprint = this.computeFingerprint();
    if (this.cache?.fingerprint === fingerprint) {
      return this.cache.prompt;
    }

    const sections: string[] = [];
    for (const file of CORE_FILES) {
      const path = resolve(this.workspacePath, file);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8').trim();
      if (text) sections.push(text);
    }

    const prompt = sections.join('\n\n---\n\n');
    this.cache = { fingerprint, prompt };
    return prompt;
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
