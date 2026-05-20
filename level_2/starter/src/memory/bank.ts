
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
    //REPLACE-MEMORY-BANK
    // Implement the MemoryBank from level_2/codelab.md §4.
    throw new Error('REPLACE-MEMORY-BANK not implemented — see level_2/codelab.md §4');
  }

  async list(category?: BankCategory): Promise<BankSummary[]> {
    //REPLACE-MEMORY-BANK
    // Implement the MemoryBank from level_2/codelab.md §4.
    throw new Error('REPLACE-MEMORY-BANK not implemented — see level_2/codelab.md §4');
  }

  async recall(
    query: string,
    opts?: { category?: BankCategory; limit?: number },
  ): Promise<BankSummary[]> {
    //REPLACE-MEMORY-BANK
    // Implement the MemoryBank from level_2/codelab.md §4.
    throw new Error('REPLACE-MEMORY-BANK not implemented — see level_2/codelab.md §4');
  }

  // Returns the markdown body of one entry, or null if absent.
  async read(category: BankCategory, slug: string): Promise<string | null> {
    const path = join(this.bankRoot, category, `${slug}.md`);
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf8');
    return raw.replace(/^---\n[\s\S]*?\n---\n+/, '');
  }
}
