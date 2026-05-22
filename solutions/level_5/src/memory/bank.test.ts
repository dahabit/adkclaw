import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryBank } from './bank.js';

let workspace: string;
let bank: MemoryBank;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-bank-'));
  bank = new MemoryBank({ workspacePath: workspace });
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('MemoryBank', () => {
  it('saves a fact and reads it back', async () => {
    const entry = await bank.save('facts', 'Coffee preference', 'User drinks coffee at 7am.');
    expect(entry.slug).toBe('coffee-preference');
    const read = await bank.read('facts', 'coffee-preference');
    expect(read?.content).toContain('User drinks coffee');
  });

  it('saves multiple categories', async () => {
    await bank.save('facts', 'Lives in Cairo', 'In Cairo time zone.');
    await bank.save('decisions', 'Use TypeScript', 'Better tooling and ecosystem.');
    await bank.save('projects', 'AdkClaw', 'Educational agent course.');
    const all = await bank.list();
    expect(all).toHaveLength(3);
    const cats = new Set(all.map((e) => e.category));
    expect(cats).toEqual(new Set(['facts', 'decisions', 'projects']));
  });

  it('list returns entries sorted by updatedAt desc', async () => {
    await bank.save('facts', 'One', 'first');
    await new Promise((r) => setTimeout(r, 10));
    await bank.save('facts', 'Two', 'second');
    const list = await bank.list('facts');
    expect(list[0]?.name).toBe('Two');
    expect(list[1]?.name).toBe('One');
  });

  it('recall with query filters by name + preview', async () => {
    await bank.save('facts', 'Loves coffee', 'Espresso, no milk.');
    await bank.save('facts', 'Owns a cat', 'Named Gizmo.');
    const r1 = await bank.recall('coffee');
    expect(r1).toHaveLength(1);
    expect(r1[0]?.name).toBe('Loves coffee');
    const r2 = await bank.recall('Gizmo');
    expect(r2).toHaveLength(1);
  });

  it('recall with empty query returns all up to limit', async () => {
    for (let i = 0; i < 5; i++) {
      await bank.save('facts', `f${i}`, 'x');
    }
    const r = await bank.recall('', { limit: 3 });
    expect(r).toHaveLength(3);
  });

  it('save is idempotent on same name (overwrite)', async () => {
    await bank.save('facts', 'Coffee', 'first version');
    await bank.save('facts', 'Coffee', 'updated version');
    const read = await bank.read('facts', 'coffee');
    expect(read?.content).toContain('updated version');
    const list = await bank.list('facts');
    expect(list).toHaveLength(1);
  });

  it('isValidCategory accepts known categories only', () => {
    expect(MemoryBank.isValidCategory('facts')).toBe(true);
    expect(MemoryBank.isValidCategory('decisions')).toBe(true);
    expect(MemoryBank.isValidCategory('weather')).toBe(false);
  });
});
