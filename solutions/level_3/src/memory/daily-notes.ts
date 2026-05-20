
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
    if (!text.trim()) return;
    await mkdir(this.memoryDir, { recursive: true });
    const path = this.pathFor(date);
    const stamp = date.toTimeString().slice(0, 5);
    const entry = `\n- **${stamp}** ${text.trim()}`;
    if (existsSync(path)) {
      const current = await readFile(path, 'utf8');
      await writeFile(path, current.trimEnd() + '\n' + entry + '\n', 'utf8');
    } else {
      const header = `# Daily Notes — ${this.isoDate(date)}\n${entry}\n`;
      await writeFile(path, header, 'utf8');
    }
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
