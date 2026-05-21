import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const BANK_CATEGORIES = ['facts', 'decisions', 'projects', 'people'] as const;
export type BankCategory = (typeof BANK_CATEGORIES)[number];

export interface BankEntry {
  category: BankCategory;
  name: string;
  slug: string;
  content: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

export interface BankSummary {
  category: BankCategory;
  slug: string;
  name: string;
  preview: string;
  updatedAt: number;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'entry'
  );
}

function isCategory(c: string): c is BankCategory {
  return (BANK_CATEGORIES as readonly string[]).includes(c);
}

function bodyAfterFrontmatter(raw: string): string {
  const match = raw.match(/^---\n[\s\S]*?\n---\n+/);
  return match ? raw.slice(match[0].length) : raw;
}

export interface MemoryBankOptions {
  workspacePath: string;
}

/**
 * MemoryBank — structured long-term memory in workspace/bank/{category}/{slug}.md.
 *
 * Categories (Paperclip + OpenClaw style):
 *   facts      — atomic verified facts about the world or the user
 *   decisions  — choices made, with rationale
 *   projects   — ongoing work, with status
 *   people     — people in the user's circle
 *
 * Each entry is a markdown file with YAML frontmatter (name, category, timestamps).
 * Append-only by default; updates rewrite the file.
 */
export class MemoryBank {
  private readonly bankRoot: string;

  constructor(opts: MemoryBankOptions) {
    this.bankRoot = resolve(opts.workspacePath, 'bank');
  }

  static isValidCategory(c: string): c is BankCategory {
    return isCategory(c);
  }

  async save(category: BankCategory, name: string, content: string): Promise<BankEntry> {
    const slug = slugify(name);
    const dir = join(this.bankRoot, category);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${slug}.md`);
    const now = new Date();

    let createdAt = now.getTime();
    if (existsSync(path)) {
      try {
        const s = await stat(path);
        createdAt = s.birthtimeMs || s.mtimeMs;
      } catch {
        // ignore
      }
    }

    const frontmatter =
      [
        '---',
        `name: ${name}`,
        `category: ${category}`,
        `slug: ${slug}`,
        `created_at: ${new Date(createdAt).toISOString()}`,
        `updated_at: ${now.toISOString()}`,
        '---',
        '',
      ].join('\n') +
      content.trim() +
      '\n';

    await writeFile(path, frontmatter, 'utf8');

    return {
      category,
      name,
      slug,
      content: content.trim(),
      path,
      createdAt,
      updatedAt: now.getTime(),
    };
  }

  async list(category?: BankCategory): Promise<BankSummary[]> {
    const out: BankSummary[] = [];
    const cats = category ? [category] : BANK_CATEGORIES;
    for (const cat of cats) {
      const dir = join(this.bankRoot, cat);
      if (!existsSync(dir)) continue;
      try {
        const entries = await readdir(dir);
        for (const f of entries) {
          if (!f.endsWith('.md')) continue;
          const path = join(dir, f);
          try {
            const raw = await readFile(path, 'utf8');
            const body = bodyAfterFrontmatter(raw);
            const preview = body.split('\n').slice(0, 2).join(' ').slice(0, 200);
            const s = await stat(path);
            const slug = f.replace(/\.md$/, '');
            const nameMatch = raw.match(/^name:\s*(.+)$/m);
            const name = nameMatch?.[1]?.trim() ?? slug;
            out.push({
              category: cat,
              slug,
              name,
              preview,
              updatedAt: s.mtimeMs,
            });
          } catch {
            // skip unreadable
          }
        }
      } catch {
        // skip
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async read(category: BankCategory, slug: string): Promise<BankEntry | null> {
    const path = join(this.bankRoot, category, `${slugify(slug)}.md`);
    if (!existsSync(path)) return null;
    try {
      const raw = await readFile(path, 'utf8');
      const body = bodyAfterFrontmatter(raw).trim();
      const s = await stat(path);
      const nameMatch = raw.match(/^name:\s*(.+)$/m);
      return {
        category,
        slug,
        name: nameMatch?.[1]?.trim() ?? slug,
        content: body,
        path,
        createdAt: s.birthtimeMs || s.mtimeMs,
        updatedAt: s.mtimeMs,
      };
    } catch {
      return null;
    }
  }

  async recall(
    query: string,
    opts?: { category?: BankCategory; limit?: number },
  ): Promise<BankSummary[]> {
    const limit = opts?.limit ?? 20;
    const all = await this.list(opts?.category);
    if (!query.trim()) return all.slice(0, limit);
    const q = query.toLowerCase();
    const matches = all.filter(
      (e) => e.name.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q),
    );
    return matches.slice(0, limit);
  }
}
