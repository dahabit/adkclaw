import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { webFetchTool } from './web-fetch.js';
import type { ToolContext } from '../types/index.js';

// Polyfill fetch for tests
if (typeof global.fetch === 'undefined') {
  global.fetch = vi.fn();
}

const ctx: ToolContext = {
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
  workspacePath: '/tmp/ws',
  config: {} as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  (global.fetch as any) = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('web_fetch tool', () => {
  it('has correct metadata', () => {
    expect(webFetchTool.name).toBe('web_fetch');
    expect(webFetchTool.permission).toBe('allow');
    expect(webFetchTool.description).toContain('Fetch');
    expect(webFetchTool.parameters.required).toEqual(['url']);
  });

  it('fetches a valid URL and returns text', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('<html><body>Hello World</body></html>'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('Fetched: https://example.com');
    expect(result.result).toContain('EXTERNAL_UNTRUSTED');
    expect(result.result).toContain('Hello World');
  });

  it('strips HTML tags from response', async () => {
    const mockResponse = {
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue('<html><body><h1>Title</h1><p>Content here</p></body></html>'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    // Should have text without HTML tags
    expect(result.result).toContain('Title');
    expect(result.result).toContain('Content here');
    expect(result.result).not.toContain('<h1>');
    expect(result.result).not.toContain('<p>');
  });

  it('rejects non-http/https URLs', async () => {
    const result = await webFetchTool.execute({ url: 'ftp://example.com' }, ctx);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/http/i);
  });

  it('rejects missing URL', async () => {
    const result = await webFetchTool.execute({}, ctx);
    expect(result.error).toBeDefined();
  });

  it('rejects invalid URLs', async () => {
    const result = await webFetchTool.execute({ url: 'not a url' }, ctx);
    expect(result.error).toBeDefined();
  });

  it('handles HTTP error responses', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com/404' }, ctx);
    expect(result.error).toContain('404');
  });

  it('handles 500 server errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com/error' }, ctx);
    expect(result.error).toContain('500');
  });

  it('handles network errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network timeout'));

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Network timeout');
  });

  it('removes script tags from content', async () => {
    const html = '<html><script>alert("xss")</script><body>Safe content</body></html>';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(html),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('Safe content');
    expect(result.result).not.toContain('alert');
  });

  it('removes style tags from content', async () => {
    const html = '<html><style>.x { color: red; }</style><body>Text</body></html>';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(html),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).not.toContain('.x');
  });

  it('decodes HTML entities', async () => {
    const html = '<body>&lt;tag&gt; &amp; &nbsp; &quot;quoted&quot; &#39;apostrophe&#39;</body>';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(html),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('<tag>');
    expect(result.result).toContain('&');
    expect(result.result).toContain('"quoted"');
  });

  it('sets appropriate user agent header', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('content'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall?.[1]?.headers;
    expect(headers?.['user-agent']).toContain('AdkClaw');
  });

  it('truncates very long responses', async () => {
    const longContent = 'x'.repeat(100000); // Much larger than MAX_BYTES
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(longContent),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    // Result should be shorter than original
    expect(result.result!.length).toBeLessThan(longContent.length);
  });

  it('handles plain text responses (no HTML)', async () => {
    const plainText = 'This is plain text without any HTML tags.';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(plainText),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com/text' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain(plainText);
  });

  it('handles JSON responses', async () => {
    const json = '{"key": "value", "number": 42}';
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(json),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://api.example.com/data' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('key');
    expect(result.result).toContain('value');
  });

  it('wraps result in EXTERNAL_UNTRUSTED tags', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('Content'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('<EXTERNAL_UNTRUSTED>');
    expect(result.result).toContain('</EXTERNAL_UNTRUSTED>');
  });

  it('handles redirects transparently via fetch', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('Redirected content'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await webFetchTool.execute({ url: 'https://example.com/redirect' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('Redirected content');
  });

  it('supports both http and https', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('content'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const resultHttp = await webFetchTool.execute({ url: 'http://example.com' }, ctx);
    expect(resultHttp.success).toBe(true);

    (global.fetch as any).mockResolvedValue(mockResponse);
    const resultHttps = await webFetchTool.execute({ url: 'https://example.com' }, ctx);
    expect(resultHttps.success).toBe(true);
  });
});
