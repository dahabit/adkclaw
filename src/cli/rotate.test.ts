import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rotate } from './rotate.js';

describe('rotate', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('returns 0 when no secret is specified (prints help)', () => {
    const code = rotate();
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('adkclaw rotate <secret>'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Available secrets to rotate'));
  });

  it('returns 0 when help is explicitly requested via empty string', () => {
    const code = rotate('');
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Available secrets to rotate'));
  });

  it('lists all available secrets in help', () => {
    rotate();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('gemini');
    expect(calls).toContain('telegram');
    expect(calls).toContain('webhook');
    expect(calls).toContain('admin');
  });

  it('returns 1 and prints help when an unknown secret is requested', () => {
    const code = rotate('unknown');
    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Available secrets to rotate'));
  });

  it('returns 0 and prints gemini runbook when gemini is requested', () => {
    const code = rotate('gemini');
    expect(code).toBe(0);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('Gemini API key');
    expect(calls).toContain('aistudio.google.com');
    expect(calls).toContain('gcloud secrets versions add gemini-api-key');
  });

  it('returns 0 and prints telegram runbook when telegram is requested', () => {
    const code = rotate('telegram');
    expect(code).toBe(0);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('Telegram bot token');
    expect(calls).toContain('@BotFather');
    expect(calls).toContain('setWebhook');
  });

  it('returns 0 and prints webhook runbook when webhook is requested', () => {
    const code = rotate('webhook');
    expect(code).toBe(0);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('Telegram webhook secret');
    expect(calls).toContain('openssl rand -hex 32');
  });

  it('returns 0 and prints admin runbook when admin is requested', () => {
    const code = rotate('admin');
    expect(code).toBe(0);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('Admin key');
    expect(calls).toContain('gcloud secrets versions add admin-key');
  });

  it('is case-insensitive (accepts GEMINI)', () => {
    const code = rotate('GEMINI');
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini API key'));
  });

  it('is case-insensitive (accepts GeMiNi)', () => {
    const code = rotate('GeMiNi');
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini API key'));
  });

  it('prints numbered steps for each runbook', () => {
    const code = rotate('gemini');
    expect(code).toBe(0);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toMatch(/1\./);
    expect(calls).toMatch(/2\./);
    expect(calls).toMatch(/3\./);
  });

  it('includes the note about manual execution', () => {
    const code = rotate('admin');
    expect(code).toBe(0);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('No command auto-runs');
    expect(calls).toContain('Document completion in RUNBOOK.md');
  });
});
