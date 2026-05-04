import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextEngine } from './manager.js';

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-ctx-'));
  mkdirSync(join(workspace, 'memory'), { recursive: true });
  mkdirSync(join(workspace, 'skills'), { recursive: true });
  mkdirSync(join(workspace, 'bank/facts'), { recursive: true });
  mkdirSync(join(workspace, 'bank/decisions'), { recursive: true });
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('ContextEngine.bootstrap', () => {
  it('returns empty prompt when no files exist', () => {
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    expect(result.systemPrompt).toBe('');
    expect(result.sections).toEqual([]);
  });

  it('reads core files in fixed order', () => {
    writeFileSync(join(workspace, 'IDENTITY.md'), 'I am Doodoo.');
    writeFileSync(join(workspace, 'USER.md'), 'User is Ahmed.');
    writeFileSync(join(workspace, 'SOUL.md'), 'Direct.');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    const order = result.sections.map((s) => s.source);
    expect(order.slice(0, 3)).toEqual(['IDENTITY.md', 'USER.md', 'SOUL.md']);
    expect(result.systemPrompt).toContain('# Identity');
    expect(result.systemPrompt).toContain('I am Doodoo.');
  });

  it('caches identical fingerprint — second call returns the same instance', () => {
    writeFileSync(join(workspace, 'IDENTITY.md'), 'A');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const a = ctx.bootstrap();
    const b = ctx.bootstrap();
    expect(b).toBe(a);
  });

  it('rebuilds when a file changes', async () => {
    writeFileSync(join(workspace, 'IDENTITY.md'), 'A');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const a = ctx.bootstrap();
    await new Promise((r) => setTimeout(r, 25));
    writeFileSync(join(workspace, 'IDENTITY.md'), 'B');
    const b = ctx.bootstrap();
    expect(b).not.toBe(a);
    expect(b.systemPrompt).toContain('B');
  });

  it("includes today's daily note when present", () => {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(join(workspace, 'memory', `${today}.md`), 'Tested context engine today.');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    expect(result.systemPrompt).toContain('Tested context engine today');
  });

  it('lists skills with description from YAML frontmatter', () => {
    writeFileSync(
      join(workspace, 'skills', 'research.md'),
      [
        '---',
        'name: research',
        'description: Research a topic from multiple sources.',
        '---',
        '',
        'Steps...',
      ].join('\n'),
    );
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    expect(result.systemPrompt).toContain('Available Skills');
    expect(result.systemPrompt).toContain('research');
    expect(result.systemPrompt).toContain('Research a topic from multiple sources.');
  });

  it('falls back to first non-heading line when no frontmatter', () => {
    writeFileSync(
      join(workspace, 'skills', 'note.md'),
      '# Heading\n\nA short description without frontmatter.\n\nMore text...',
    );
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    expect(result.systemPrompt).toContain('A short description without frontmatter.');
  });

  it('indexes memory bank entries by category', () => {
    writeFileSync(join(workspace, 'bank/facts/coffee.md'), 'Ahmed drinks coffee.');
    writeFileSync(join(workspace, 'bank/decisions/stack.md'), 'Use TypeScript.');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    expect(result.systemPrompt).toContain('Memory Bank Index');
    expect(result.systemPrompt).toContain('facts');
    expect(result.systemPrompt).toContain('decisions');
  });

  it('places HEARTBEAT.md last in the assembled prompt', () => {
    writeFileSync(join(workspace, 'IDENTITY.md'), 'me');
    writeFileSync(join(workspace, 'HEARTBEAT.md'), '- check email');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const result = ctx.bootstrap();
    const sources = result.sections.map((s) => s.source);
    expect(sources[sources.length - 1]).toBe('HEARTBEAT.md');
  });

  it('invalidate() forces rebuild on next bootstrap', () => {
    writeFileSync(join(workspace, 'IDENTITY.md'), 'A');
    const ctx = new ContextEngine({ workspacePath: workspace });
    const a = ctx.bootstrap();
    ctx.invalidate();
    const b = ctx.bootstrap();
    expect(b).not.toBe(a);
    expect(b.systemPrompt).toBe(a.systemPrompt);
  });
});
