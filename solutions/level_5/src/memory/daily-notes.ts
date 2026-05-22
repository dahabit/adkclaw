import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function timeStamp(d = new Date()): string {
  return d.toTimeString().slice(0, 5);
}

export interface DailyNotesOptions {
  workspacePath: string;
}

/**
 * DailyNotes — append-only timestamped log under workspace/memory/YYYY-MM-DD.md.
 * Source material for the consolidator.
 */
export class DailyNotes {
  private readonly memoryDir: string;

  constructor(opts: DailyNotesOptions) {
    this.memoryDir = resolve(opts.workspacePath, 'memory');
  }

  private pathFor(date: Date | string = new Date()): string {
    const d = typeof date === 'string' ? date : isoDate(date);
    return join(this.memoryDir, `${d}.md`);
  }

  async append(text: string, date: Date = new Date()): Promise<void> {
    if (!text.trim()) return;
    await mkdir(this.memoryDir, { recursive: true });
    const path = this.pathFor(date);
    const stamp = timeStamp(date);
    const entry = `\n- **${stamp}** ${text.trim()}`;
    if (existsSync(path)) {
      const current = await readFile(path, 'utf8');
      await writeFile(path, current.trimEnd() + '\n' + entry + '\n', 'utf8');
    } else {
      const header = `# Daily Notes — ${isoDate(date)}\n${entry}\n`;
      await writeFile(path, header, 'utf8');
    }
  }

  async read(date: Date | string = new Date()): Promise<string | null> {
    const path = this.pathFor(date);
    if (!existsSync(path)) return null;
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  }

  async listDates(): Promise<string[]> {
    if (!existsSync(this.memoryDir)) return [];
    try {
      const files = await readdir(this.memoryDir);
      return files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .map((f) => f.replace(/\.md$/, ''))
        .sort();
    } catch {
      return [];
    }
  }
}
