import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyDirectoryWithSubstitutions } from './setup.js';

let src: string;
let dst: string;

beforeEach(() => {
  src = mkdtempSync(join(tmpdir(), 'adkclaw-setup-src-'));
  dst = mkdtempSync(join(tmpdir(), 'adkclaw-setup-dst-'));
  // mkdtempSync creates dst — remove so copy can recreate
  rmSync(dst, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(src, { recursive: true, force: true });
  rmSync(dst, { recursive: true, force: true });
});

describe('copyDirectoryWithSubstitutions', () => {
  it('substitutes placeholders in copied files', async () => {
    writeFileSync(join(src, 'IDENTITY.md'), 'I am {{AGENT_NAME}}.');
    await copyDirectoryWithSubstitutions(src, dst, { '{{AGENT_NAME}}': 'Doodoo' });
    const out = readFileSync(join(dst, 'IDENTITY.md'), 'utf8');
    expect(out).toBe('I am Doodoo.');
  });

  it('copies nested directories with substitutions', async () => {
    mkdirSync(join(src, 'memory'));
    writeFileSync(join(src, 'memory', 'note.md'), 'Hi {{USER_NAME}}.');
    await copyDirectoryWithSubstitutions(src, dst, { '{{USER_NAME}}': 'Ahmed' });
    const out = readFileSync(join(dst, 'memory', 'note.md'), 'utf8');
    expect(out).toBe('Hi Ahmed.');
  });

  it('skips .gitkeep files', async () => {
    mkdirSync(join(src, 'sub'));
    writeFileSync(join(src, 'sub', '.gitkeep'), '');
    writeFileSync(join(src, 'sub', 'real.md'), 'hi');
    await copyDirectoryWithSubstitutions(src, dst, {});
    expect(existsSync(join(dst, 'sub', 'real.md'))).toBe(true);
    expect(existsSync(join(dst, 'sub', '.gitkeep'))).toBe(false);
  });

  it('substitutes multiple distinct placeholders in the same file', async () => {
    writeFileSync(
      join(src, 'SOUL.md'),
      'Tone: {{AGENT_TONE}}. Talking to {{USER_NAME}} as {{AGENT_NAME}}.',
    );
    await copyDirectoryWithSubstitutions(src, dst, {
      '{{AGENT_NAME}}': 'Doodoo',
      '{{USER_NAME}}': 'Ahmed',
      '{{AGENT_TONE}}': 'direct',
    });
    const out = readFileSync(join(dst, 'SOUL.md'), 'utf8');
    expect(out).toBe('Tone: direct. Talking to Ahmed as Doodoo.');
  });

  it('handles files without placeholders unchanged', async () => {
    writeFileSync(join(src, 'AGENTS.md'), '## Plain content\n\nNothing to substitute.');
    await copyDirectoryWithSubstitutions(src, dst, { '{{AGENT_NAME}}': 'X' });
    const out = readFileSync(join(dst, 'AGENTS.md'), 'utf8');
    expect(out).toBe('## Plain content\n\nNothing to substitute.');
  });
});
