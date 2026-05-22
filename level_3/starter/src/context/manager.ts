// src/context/manager.ts
//
// System-prompt assembly. The prompt is NOT hardcoded — it is rebuilt every
// turn from markdown files in workspace/, cached by an aggregate mtime
// fingerprint. Edit a workspace file and the next turn picks it up.
//
// Read order (later sections layer on earlier ones):
//   IDENTITY → USER → SOUL → AGENTS → MEMORY → TOOLS
//   → today's daily note → memory-bank index → skills index → HEARTBEAT
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BootstrapSection {
  source: string;
  heading: string;
  content: string;
}

export interface BootstrapResult {
  systemPrompt: string;
  sections: BootstrapSection[];
  totalChars: number;
}

const CORE_FILES: Array<{ filename: string; heading: string }> = [
  { filename: 'IDENTITY.md', heading: 'Identity' },
  { filename: 'USER.md', heading: 'User' },
  { filename: 'SOUL.md', heading: 'Soul (Personality)' },
  { filename: 'AGENTS.md', heading: 'Behavioral Rules' },
  { filename: 'MEMORY.md', heading: 'Long-term Memory' },
  { filename: 'TOOLS.md', heading: 'Tool Notes' },
];

const BANK_CATEGORIES = ['facts', 'decisions', 'projects', 'people'] as const;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeRead(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function safeMtime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function extractSkillDescription(content: string): string {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (fm && fm[1]) {
    const desc = fm[1].match(/description:\s*(.+)/);
    if (desc && desc[1]) return desc[1].trim();
  }
  const firstLine = content
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  return firstLine ?? '(no description)';
}

export class ContextEngine {
  private cached: BootstrapResult | null = null;
  private cacheKey: string | null = null;

  constructor(private readonly workspacePath: string) {}

  bootstrap(): BootstrapResult {
    //REPLACE-CONTEXT-ENGINE
    // Build the system prompt from workspace files in fixed order, cached
    // by aggregate mtime fingerprint. From level_3/codelab.md §2.
    throw new Error('REPLACE-CONTEXT-ENGINE not implemented — see level_3/codelab.md §2');
  }

  invalidate(): void {
    this.cached = null;
    this.cacheKey = null;
  }

  // fingerprint() MUST scan every file/dir bootstrap() reads — miss one and
  // the cache won't invalidate when that source changes.
  private fingerprint(): string {
    //REPLACE-CONTEXT-ENGINE
    // Aggregate mtime stamp of every file/dir bootstrap reads. From level_3/codelab.md §2.
    throw new Error('REPLACE-CONTEXT-ENGINE not implemented — see level_3/codelab.md §2');
  }

  private indexBank(): string | null {
    //REPLACE-CONTEXT-ENGINE
    // Sample the bank into a compact index for the system prompt. From level_3/codelab.md §2.
    throw new Error('REPLACE-CONTEXT-ENGINE not implemented — see level_3/codelab.md §2');
  }

  private loadSkills(): string | null {
    //REPLACE-CONTEXT-ENGINE
    // Sample workspace/skills/ into a system-prompt slice. From level_3/codelab.md §2.
    throw new Error('REPLACE-CONTEXT-ENGINE not implemented — see level_3/codelab.md §2');
  }
}
