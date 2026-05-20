
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export class DailyNotes {
  private readonly memoryDir: string;

  constructor(opts: { workspacePath: string }) {
    this.memoryDir = resolve(opts.workspacePath, 'memory');
  }

  private isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private pathFor(date: Date): string {
    return join(this.memoryDir, `${this.isoDate(date)}.md`);
  }

  async append(text: string, date: Date = new Date()): Promise<void> {
    //REPLACE-MEMORY-DAILY
    // Append a timestamped line to today's daily note. From level_2/codelab.md §5.
    throw new Error('REPLACE-MEMORY-DAILY not implemented — see level_2/codelab.md §5');
  }

  // treated as an already-formatted YYYY-MM-DD; a Date is normalised.
  async read(date: Date | string = new Date()): Promise<string | null> {
    const iso = typeof date === 'string' ? date : this.isoDate(date);
    const path = join(this.memoryDir, `${iso}.md`);
    if (!existsSync(path)) return null;
    return readFile(path, 'utf8');
  }

  async listDates(): Promise<string[]> {
    if (!existsSync(this.memoryDir)) return [];
    const files = await readdir(this.memoryDir);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
  }
}
