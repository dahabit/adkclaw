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
    const fingerprint = this.fingerprint();
    if (this.cacheKey === fingerprint && this.cached) return this.cached;

    const sections: BootstrapSection[] = [];

    for (const { filename, heading } of CORE_FILES) {
      const content = safeRead(resolve(this.workspacePath, filename));
      if (content && content.trim()) {
        sections.push({ source: filename, heading, content: content.trim() });
      }
    }

    const today = todayDate();
    const daily = safeRead(resolve(this.workspacePath, 'memory', `${today}.md`));
    if (daily && daily.trim()) {
      sections.push({
        source: `memory/${today}.md`,
        heading: `Daily note (${today})`,
        content: daily.trim(),
      });
    }

    const bankIndex = this.indexBank();
    if (bankIndex) {
      sections.push({ source: 'bank/', heading: 'Memory Bank Index', content: bankIndex });
    }

    const skills = this.loadSkills();
    if (skills) {
      sections.push({ source: 'skills/', heading: 'Available Skills', content: skills });
    }

    const heartbeat = safeRead(resolve(this.workspacePath, 'HEARTBEAT.md'));
    if (heartbeat && heartbeat.trim()) {
      sections.push({
        source: 'HEARTBEAT.md',
        heading: 'Heartbeat Tasks',
        content: heartbeat.trim(),
      });
    }

    const systemPrompt = sections.map((s) => `# ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');

    const result: BootstrapResult = { systemPrompt, sections, totalChars: systemPrompt.length };
    this.cached = result;
    this.cacheKey = fingerprint;
    return result;
  }

  invalidate(): void {
    this.cached = null;
    this.cacheKey = null;
  }

  // fingerprint() MUST scan every file/dir bootstrap() reads — miss one and
  // the cache won't invalidate when that source changes.
  private fingerprint(): string {
    const parts: string[] = [];
    for (const { filename } of CORE_FILES) {
      parts.push(`${filename}:${safeMtime(resolve(this.workspacePath, filename))}`);
    }
    const today = todayDate();
    parts.push(
      `memory/${today}.md:${safeMtime(resolve(this.workspacePath, 'memory', `${today}.md`))}`,
    );
    parts.push(`HEARTBEAT.md:${safeMtime(resolve(this.workspacePath, 'HEARTBEAT.md'))}`);
    parts.push(`skills:${safeMtime(resolve(this.workspacePath, 'skills'))}`);
    parts.push(`bank:${safeMtime(resolve(this.workspacePath, 'bank'))}`);
    const skillsDir = resolve(this.workspacePath, 'skills');
    if (existsSync(skillsDir)) {
      try {
        for (const f of readdirSync(skillsDir).sort()) {
          if (f.endsWith('.md')) parts.push(`skills/${f}:${safeMtime(resolve(skillsDir, f))}`);
        }
      } catch {
        // ignore
      }
    }
    return parts.join('|');
  }

  private indexBank(): string | null {
    const bankRoot = resolve(this.workspacePath, 'bank');
    if (!existsSync(bankRoot)) return null;
    const lines: string[] = [];
    for (const cat of BANK_CATEGORIES) {
      const dir = resolve(bankRoot, cat);
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir).filter((f) => f.endsWith('.md'));
        if (entries.length === 0) continue;
        const sample = entries.slice(0, 10).join(', ');
        const more = entries.length > 10 ? ', ...' : '';
        lines.push(`- **${cat}** (${entries.length}): ${sample}${more}`);
      } catch {
        // skip
      }
    }
    return lines.length > 0 ? lines.join('\n') : null;
  }

  private loadSkills(): string | null {
    const dir = resolve(this.workspacePath, 'skills');
    if (!existsSync(dir)) return null;
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
      if (files.length === 0) return null;
      const out: string[] = [];
      for (const f of files.sort()) {
        const content = safeRead(resolve(dir, f));
        if (!content) continue;
        out.push(`- **${f.replace(/\.md$/, '')}** — ${extractSkillDescription(content)}`);
      }
      return out.length > 0 ? out.join('\n') : null;
    } catch {
      return null;
    }
  }
}
