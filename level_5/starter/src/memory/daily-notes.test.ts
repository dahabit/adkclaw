import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DailyNotes } from './daily-notes.js';

let workspace: string;
let daily: DailyNotes;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-daily-'));
  daily = new DailyNotes({ workspacePath: workspace });
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('DailyNotes', () => {
  it('creates a new daily file with a header', async () => {
    await daily.append('First entry');
    const today = new Date().toISOString().slice(0, 10);
    const content = await daily.read();
    expect(content).toContain(`# Daily Notes — ${today}`);
    expect(content).toContain('First entry');
  });

  it('appends to an existing daily file', async () => {
    await daily.append('First');
    await daily.append('Second');
    const content = await daily.read();
    expect(content).toContain('First');
    expect(content).toContain('Second');
    const matches = content?.match(/-\s\*\*\d{2}:\d{2}\*\*/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null for non-existent date', async () => {
    expect(await daily.read('1999-01-01')).toBeNull();
  });

  it('listDates returns ISO-format date filenames sorted', async () => {
    await daily.append('today');
    const list = await daily.listDates();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('append("") is a no-op', async () => {
    await daily.append('');
    expect(await daily.read()).toBeNull();
  });
});
