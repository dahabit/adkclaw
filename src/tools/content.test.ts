import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTextCreateTool, makePresentationCreateTool, makePdfCreateTool } from './content.js';
import type { ToolContext } from '../types/index.js';

let workspace: string;

function ctx(): ToolContext {
  return {
    session: {
      key: 's',
      kind: 'main',
      parentKey: null,
      channel: null,
      target: null,
      senderId: null,
      createdAt: 0,
      updatedAt: 0,
      lastMessageAt: null,
      model: '',
      totalTokens: 0,
      isArchived: false,
    },
    workspacePath: workspace,
    config: {} as never,
  };
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-content-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('text_create', () => {
  it('writes a markdown file with slugified name', async () => {
    const tool = makeTextCreateTool();
    const r = await tool.execute({ title: 'Hello World!', content: '# Note' }, ctx());
    expect(r.success).toBe(true);
    expect(existsSync(join(workspace, 'output', 'hello-world.md'))).toBe(true);
    expect(readFileSync(join(workspace, 'output', 'hello-world.md'), 'utf8')).toBe('# Note');
  });

  it('respects custom extension', async () => {
    const tool = makeTextCreateTool();
    await tool.execute({ title: 'data', content: '{"a":1}', extension: 'json' }, ctx());
    expect(existsSync(join(workspace, 'output', 'data.json'))).toBe(true);
  });
});

describe('presentation_create', () => {
  it('writes a Marp deck with frontmatter', async () => {
    const tool = makePresentationCreateTool();
    const r = await tool.execute(
      {
        title: 'Intro to Agents',
        theme: 'gaia',
        slides: [
          { heading: 'Intro to Agents', body: 'A 4-workshop series.' },
          { heading: 'What is an Agent?', body: '- Brain\n- Tools\n- Memory' },
        ],
      },
      ctx(),
    );
    expect(r.success).toBe(true);
    const content = readFileSync(join(workspace, 'output', 'intro-to-agents.md'), 'utf8');
    expect(content).toContain('marp: true');
    expect(content).toContain('theme: gaia');
    expect(content).toContain('# Intro to Agents');
    expect(content).toContain('## What is an Agent?');
    expect(content).toContain('---'); // slide separator
  });

  it('errors when no slides', async () => {
    const tool = makePresentationCreateTool();
    const r = await tool.execute({ title: 't', slides: [] }, ctx());
    expect(r.error).toBeDefined();
  });
});

describe('pdf_create', () => {
  it('produces a non-empty PDF file', async () => {
    const tool = makePdfCreateTool();
    const r = await tool.execute(
      {
        title: 'Test Brief',
        author: 'Tester',
        sections: [
          { heading: 'Intro', text: 'This is the intro paragraph.' },
          { heading: 'Findings', text: 'Some findings here.' },
        ],
      },
      ctx(),
    );
    expect(r.success).toBe(true);
    const pdfPath = join(workspace, 'output', 'test-brief.pdf');
    expect(existsSync(pdfPath)).toBe(true);
    const buf = readFileSync(pdfPath);
    expect(buf.length).toBeGreaterThan(500);
    // PDF magic header
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('errors when sections empty', async () => {
    const tool = makePdfCreateTool();
    const r = await tool.execute({ title: 'x', sections: [] }, ctx());
    expect(r.error).toBeDefined();
  });
});
