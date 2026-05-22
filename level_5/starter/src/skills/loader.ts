import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export interface Skill {
  name: string;
  description: string;
  whenToInvoke: string | null;
  body: string;
  path: string;
  updatedAt: number;
}

export interface SkillSummary {
  name: string;
  description: string;
  whenToInvoke: string | null;
  updatedAt: number;
}

export interface SkillsLoaderOptions {
  workspacePath: string;
}

interface ParsedSkill {
  description: string;
  whenToInvoke: string | null;
  body: string;
}

function parseFrontmatter(raw: string): ParsedSkill {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n+/);
  if (!fmMatch) {
    return {
      description: raw.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '',
      whenToInvoke: null,
      body: raw.trim(),
    };
  }
  const fm = fmMatch[1] ?? '';
  const body = raw.slice(fmMatch[0].length).trim();
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const whenMatch = fm.match(/^when_to_invoke:\s*(.+)$/m);
  return {
    description: descMatch?.[1]?.trim() ?? '',
    whenToInvoke: whenMatch?.[1]?.trim() ?? null,
    body,
  };
}

/**
 * SkillsLoader — lists and loads markdown skill files from workspace/skills/.
 *
 * Each skill file is markdown with YAML frontmatter:
 *   ---
 *   name: research-topic
 *   description: Research a topic from multiple sources.
 *   when_to_invoke: User says "research X" or "look into Y".
 *   ---
 *   ## Steps
 *   ...
 *
 * The ContextEngine bootstrap lists skills (name + description). When the agent
 * decides to use one, it calls the load_skill tool which returns the full body.
 */
export class SkillsLoader {
  private readonly skillsDir: string;

  constructor(opts: SkillsLoaderOptions) {
    this.skillsDir = resolve(opts.workspacePath, 'skills');
  }

  async list(): Promise<SkillSummary[]> {
    if (!existsSync(this.skillsDir)) return [];
    try {
      const files = await readdir(this.skillsDir);
      const out: SkillSummary[] = [];
      for (const f of files.sort()) {
        if (!f.endsWith('.md')) continue;
        const path = join(this.skillsDir, f);
        try {
          const raw = await readFile(path, 'utf8');
          const parsed = parseFrontmatter(raw);
          const s = await stat(path);
          out.push({
            name: f.replace(/\.md$/, ''),
            description: parsed.description,
            whenToInvoke: parsed.whenToInvoke,
            updatedAt: s.mtimeMs,
          });
        } catch {
          // skip unreadable
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  async load(name: string): Promise<Skill | null> {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeName) return null;
    const candidates = [
      join(this.skillsDir, `${safeName}.md`),
      join(this.skillsDir, safeName.endsWith('.md') ? safeName : `${safeName}.md`),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        const raw = await readFile(path, 'utf8');
        const parsed = parseFrontmatter(raw);
        const s = await stat(path);
        return {
          name: safeName,
          description: parsed.description,
          whenToInvoke: parsed.whenToInvoke,
          body: parsed.body,
          path,
          updatedAt: s.mtimeMs,
        };
      } catch {
        continue;
      }
    }
    return null;
  }
}
