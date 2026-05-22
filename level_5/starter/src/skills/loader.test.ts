import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SkillsLoader } from './loader.js';

let workspace: string;
let loader: SkillsLoader;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-skills-'));
  mkdirSync(join(workspace, 'skills'), { recursive: true });
  loader = new SkillsLoader({ workspacePath: workspace });
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('SkillsLoader.list', () => {
  it('returns empty list when no skills', async () => {
    expect(await loader.list()).toEqual([]);
  });

  it('parses frontmatter description and when_to_invoke', async () => {
    writeFileSync(
      join(workspace, 'skills', 'research.md'),
      [
        '---',
        'name: research',
        'description: Research a topic from multiple sources.',
        'when_to_invoke: User says "research X".',
        '---',
        '',
        '## Steps',
        '1. web_search',
        '2. summarize',
      ].join('\n'),
    );
    const list = await loader.list();
    expect(list).toHaveLength(1);
    const skill = list[0];
    expect(skill?.name).toBe('research');
    expect(skill?.description).toBe('Research a topic from multiple sources.');
    expect(skill?.whenToInvoke).toBe('User says "research X".');
  });

  it('falls back to first non-heading line when no frontmatter', async () => {
    writeFileSync(
      join(workspace, 'skills', 'plain.md'),
      '# Heading\n\nThis is the description.\n\nMore text.',
    );
    const list = await loader.list();
    expect(list[0]?.description).toBe('This is the description.');
    expect(list[0]?.whenToInvoke).toBeNull();
  });
});

describe('SkillsLoader.load', () => {
  it('returns full skill body', async () => {
    writeFileSync(
      join(workspace, 'skills', 'research.md'),
      ['---', 'description: Research.', '---', '', 'BODY CONTENT HERE'].join('\n'),
    );
    const skill = await loader.load('research');
    expect(skill).not.toBeNull();
    expect(skill?.body).toBe('BODY CONTENT HERE');
    expect(skill?.description).toBe('Research.');
  });

  it('returns null for missing skill', async () => {
    expect(await loader.load('does-not-exist')).toBeNull();
  });

  it('rejects unsafe names with path separators', async () => {
    writeFileSync(join(workspace, 'skills', 'real.md'), 'real content');
    const skill = await loader.load('../../etc/passwd');
    // The sanitization strips path chars; "etcpasswd" doesn't exist.
    expect(skill).toBeNull();
  });

  it('handles names with trailing .md', async () => {
    writeFileSync(join(workspace, 'skills', 'note.md'), 'body');
    const skill = await loader.load('note.md');
    expect(skill).not.toBeNull();
  });
});
