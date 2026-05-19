import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctor } from './doctor.js';

describe('doctor', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;
  let originalCwd: string;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'adkclaw-doctor-'));
    process.chdir(tmpDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchSpy = vi
      .spyOn(global, 'fetch' as any)
      .mockImplementation(() => Promise.reject(new Error('Network unreachable')));
  });

  afterEach(() => {
    logSpy.mockRestore();
    fetchSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('checks Node.js version >= 22', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key');

    const code = await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    if (parseInt(process.version.slice(1)) >= 22) {
      expect(calls).toContain('Node.js');
      expect(calls).not.toContain('need 22+');
    }
  });

  it('fails when GEMINI_API_KEY is missing', async () => {
    writeFileSync(join(tmpDir, '.env'), '');

    const code = await doctor();
    expect(code).toBe(1);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('GEMINI_API_KEY');
    expect(calls).toContain('missing or placeholder');
  });

  it('fails when GEMINI_API_KEY is a placeholder', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=your_api_key_here');

    const code = await doctor();
    expect(code).toBe(1);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('GEMINI_API_KEY');
    expect(calls).toContain('missing or placeholder');
  });

  it('warns when TELEGRAM_BOT_TOKEN is missing', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key');

    const code = await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain("won't come online");
  });

  it('passes when TELEGRAM_BOT_TOKEN is set and not placeholder', async () => {
    writeFileSync(
      join(tmpDir, '.env'),
      'GEMINI_API_KEY=sk-real-key\nTELEGRAM_BOT_TOKEN=123456:ABCdef',
    );
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('TELEGRAM_BOT_TOKEN');
  });

  it('attempts to reach Telegram getMe endpoint when token is valid', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key\nTELEGRAM_BOT_TOKEN=123:ABC');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { username: 'testbot' } }), {
        status: 200,
      }),
    );

    await doctor();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bot123:ABC/getMe'),
    );
  });

  it('shows the Telegram username when getMe succeeds', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key\nTELEGRAM_BOT_TOKEN=123:ABC');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { username: 'mybot' } }), {
        status: 200,
      }),
    );

    await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('@mybot');
  });

  it('warns when Telegram getMe fails', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key\nTELEGRAM_BOT_TOKEN=123:ABC');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error_code: 401 }), { status: 200 }),
    );

    await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('Telegram bot');
  });

  it('pings daemon health at localhost:3000 by default', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key');

    await doctor();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('localhost:3000/api/health'),
      expect.any(Object),
    );
  });

  it('uses ADKCLAW_API_BASE if set', async () => {
    writeFileSync(
      join(tmpDir, '.env'),
      'GEMINI_API_KEY=sk-real-key\nADKCLAW_API_BASE=http://example.com:8080',
    );

    await doctor();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('example.com:8080/api/health'),
      expect.any(Object),
    );
  });

  it('warns when daemon is not responding', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key');

    await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('not responding');
  });

  it('pings Cloud Run service if SERVICE_URL is set', async () => {
    writeFileSync(
      join(tmpDir, '.env'),
      'GEMINI_API_KEY=sk-real-key\nSERVICE_URL=https://example.run.app',
    );
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // daemon check
      .mockResolvedValueOnce(new Response('', { status: 200 })); // service check

    await doctor();
    expect(fetchSpy).toHaveBeenCalledWith('https://example.run.app');
  });

  it('shows status code for Cloud Run service', async () => {
    writeFileSync(
      join(tmpDir, '.env'),
      'GEMINI_API_KEY=sk-real-key\nSERVICE_URL=https://example.run.app',
    );
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    await doctor();
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('401');
  });

  it('reads .env file from current working directory', async () => {
    writeFileSync(join(tmpDir, '.env'), 'GEMINI_API_KEY=sk-real-key');

    await doctor();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GEMINI_API_KEY'));
  });

  it('handles missing .env gracefully', async () => {
    const code = await doctor();
    expect(code).toBe(1);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('GEMINI_API_KEY');
  });

  it('shows summary with check count when failures occur', async () => {
    writeFileSync(join(tmpDir, '.env'), '');

    const code = await doctor();
    expect(code).toBe(1);
    const calls = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(calls).toContain('check(s) failed');
  });
});
