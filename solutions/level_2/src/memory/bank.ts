
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class MemoryBank {
  private readonly bankRoot: string;

  constructor(opts: { workspacePath: string }) {
    this.bankRoot = resolve(opts.workspacePath, 'bank');
  }

  static isValidCategory(x: string): x is BankCategory {
    return (BANK_CATEGORIES as readonly string[]).includes(x);
  }

  async save(category: BankCategory, name: string, content: string): Promise<BankEntry> {
    const slug = slugify(name);
    const dir = join(this.bankRoot, category);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${slug}.md`);

    const now = new Date();
    let createdAt = now.getTime();
    if (existsSync(path)) {
      createdAt = (await stat(path)).birthtimeMs || (await stat(path)).mtimeMs;
    }

    const frontmatter = [
      '---',
      `name: ${name}`,
      `category: ${category}`,
      `slug: ${slug}`,
      `created_at: ${new Date(createdAt).toISOString()}`,
      `updated_at: ${now.toISOString()}`,
      '---',
      '',
    ].join('\n');

    await writeFile(path, frontmatter + content.trim() + '\n', 'utf8');
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
    const cats: readonly BankCategory[] = category ? [category] : BANK_CATEGORIES;
    for (const cat of cats) {
      const dir = join(this.bankRoot, cat);
      if (!existsSync(dir)) continue;
      for (const f of await readdir(dir)) {
        if (!f.endsWith('.md')) continue;
        const path = join(dir, f);
        const raw = await readFile(path, 'utf8');
        const body = raw.replace(/^---\n[\s\S]*?\n---\n+/, '');
        const preview = body.split('\n').slice(0, 2).join(' ').slice(0, 200);
        const s = await stat(path);
        const slug = f.replace(/\.md$/, '');
        const name = raw.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? slug;
        out.push({ category: cat, slug, name, preview, updatedAt: s.mtimeMs });
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async recall(
    query: string,
    opts?: { category?: BankCategory; limit?: number },
  ): Promise<BankSummary[]> {
    const all = await this.list(opts?.category);
    if (!query.trim()) return all.slice(0, opts?.limit ?? 20);
    const q = query.toLowerCase();
    return all
      .filter((e) => e.name.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q))
      .slice(0, opts?.limit ?? 20);
  }

  // Returns the markdown body of one entry, or null if absent.
  async read(category: BankCategory, slug: string): Promise<string | null> {
    const path = join(this.bankRoot, category, `${slug}.md`);
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf8');
    return raw.replace(/^---\n[\s\S]*?\n---\n+/, '');
  }
}
