import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolContext } from '../types/index.js';

// Playwright is heavy — mock it so tests run without a browser
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        content: vi.fn().mockResolvedValue('<html><body><h1>Hello World</h1></body></html>'),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        setViewportSize: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockImplementation(({ path: p }: { path: string }) => {
          // write a tiny PNG stub so existsSync passes
          require('node:fs').writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
          return Promise.resolve();
        }),
        pdf: vi.fn().mockImplementation(({ path: p }: { path: string }) => {
          require('node:fs').writeFileSync(p, Buffer.from('%PDF-1.4'));
          return Promise.resolve();
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { makeBrowserFetchTool, makeBrowserScreenshotTool, makeBrowserPdfTool } from './browser.js';

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
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-browser-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('browser_fetch', () => {
  it('returns text content from a JS page', async () => {
    const tool = makeBrowserFetchTool();
    const r = await tool.execute({ url: 'https://example.com' }, ctx());
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain('Hello World');
  });

  it('errors when url is missing', async () => {
    const tool = makeBrowserFetchTool();
    const r = await tool.execute({}, ctx());
    expect(r.error).toBeDefined();
  });

  it('has fallbackToolName set to web_fetch', () => {
    const tool = makeBrowserFetchTool();
    expect(tool.fallbackToolName).toBe('web_fetch');
  });
});

describe('browser_screenshot', () => {
  it('saves a PNG file to workspace/output', async () => {
    const tool = makeBrowserScreenshotTool();
    const r = await tool.execute({ url: 'https://example.com', filename: 'test-shot' }, ctx());
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain('test-shot.png');
    expect(existsSync(join(workspace, 'output', 'test-shot.png'))).toBe(true);
  });
});

describe('browser_pdf', () => {
  it('saves a PDF file to workspace/output', async () => {
    const tool = makeBrowserPdfTool();
    const r = await tool.execute({ url: 'https://example.com', filename: 'my-doc' }, ctx());
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain('my-doc.pdf');
    expect(existsSync(join(workspace, 'output', 'my-doc.pdf'))).toBe(true);
  });

  it('errors when filename is missing', async () => {
    const tool = makeBrowserPdfTool();
    const r = await tool.execute({ url: 'https://example.com' }, ctx());
    expect(r.error).toBeDefined();
  });
});
