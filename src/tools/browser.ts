import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { AgentTool } from '../types/index.js';

function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 12_000);
}

async function getBrowser() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch {
    return null;
  }
}

export function makeBrowserFetchTool(): AgentTool {
  return {
    name: 'browser_fetch',
    description:
      'Fetch a JS-rendered web page using a real browser. Use this instead of web_fetch when the page requires JavaScript to load content (SPAs, dynamic dashboards, lazy-loaded tables). Returns the visible text of the page.',
    permission: 'allow',
    fallbackToolName: 'web_fetch',
    parameters: {
      type: 'object',
      description: 'Browser fetch request',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        waitForSelector: {
          type: 'string',
          description: 'CSS selector to wait for before extracting content (optional)',
        },
      },
      required: ['url'],
    },
    async execute(args) {
      const url = String(args.url ?? '');
      if (!url) return { error: 'url is required' };

      const chromium = await getBrowser();
      if (!chromium) {
        return {
          error:
            'Playwright browser not available. Run `npx playwright install chromium` to enable it. Falling back to web_fetch.',
        };
      }

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        if (args.waitForSelector) {
          await page
            .waitForSelector(String(args.waitForSelector), { timeout: 10_000 })
            .catch(() => null);
        }
        const html = await page.content();
        const text = textFromHtml(html);
        return { success: true, url, result: text };
      } finally {
        await browser.close();
      }
    },
  };
}

export function makeBrowserScreenshotTool(): AgentTool {
  return {
    name: 'browser_screenshot',
    description:
      'Take a full-page screenshot of a URL and save it to workspace/output/. Useful for capturing dashboards, charts, or page state for reports.',
    permission: 'ask',
    parameters: {
      type: 'object',
      description: 'Screenshot request',
      properties: {
        url: { type: 'string', description: 'URL to screenshot' },
        filename: {
          type: 'string',
          description: 'Output filename without extension (default: screenshot)',
        },
      },
      required: ['url'],
    },
    async execute(args, ctx) {
      const url = String(args.url ?? '');
      if (!url) return { error: 'url is required' };
      const name = String(args.filename ?? 'screenshot').replace(/[^a-z0-9_-]/gi, '-');

      const chromium = await getBrowser();
      if (!chromium) {
        return {
          error:
            'Playwright browser not available. Run `npx playwright install chromium` to enable it.',
        };
      }

      const outputDir = join(ctx.workspacePath, 'output');
      await mkdir(outputDir, { recursive: true });
      const outPath = join(outputDir, `${name}.png`);

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        await page.screenshot({ path: outPath, fullPage: true });
        return { success: true, result: `Screenshot saved to output/${name}.png`, path: outPath };
      } finally {
        await browser.close();
      }
    },
  };
}

export function makeBrowserPdfTool(): AgentTool {
  return {
    name: 'browser_pdf',
    description:
      'Render a URL to PDF using the browser print engine and save it to workspace/output/. Produces styled PDFs from web pages or locally-hosted Marp presentations.',
    permission: 'ask',
    parameters: {
      type: 'object',
      description: 'Browser print-to-PDF request',
      properties: {
        url: { type: 'string', description: 'URL or local file:// path to print' },
        filename: { type: 'string', description: 'Output filename without extension' },
      },
      required: ['url', 'filename'],
    },
    async execute(args, ctx) {
      const url = String(args.url ?? '');
      if (!url || !args.filename) return { error: 'url and filename are required' };
      const name = String(args.filename).replace(/[^a-z0-9_-]/gi, '-') || 'document';

      const chromium = await getBrowser();
      if (!chromium) {
        return {
          error:
            'Playwright browser not available. Run `npx playwright install chromium` to enable it.',
        };
      }

      const outputDir = join(ctx.workspacePath, 'output');
      await mkdir(outputDir, { recursive: true });
      const outPath = join(outputDir, `${name}.pdf`);

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        await page.pdf({ path: outPath, format: 'A4', printBackground: true });
        return { success: true, result: `PDF saved to output/${name}.pdf`, path: outPath };
      } finally {
        await browser.close();
      }
    },
  };
}
