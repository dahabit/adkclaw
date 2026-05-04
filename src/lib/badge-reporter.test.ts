/**
 * Unit tests for BadgeReporter — the agent → platform self-reporting client.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BadgeReporter } from './badge-reporter.js';

describe('BadgeReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('disables itself when no username/secret provided', () => {
    const r = new BadgeReporter({ logger: () => {} });
    expect(r.isEnabled()).toBe(false);
  });

  it('disables when username present but secret missing', () => {
    const r = new BadgeReporter({ username: 'u', logger: () => {} });
    expect(r.isEnabled()).toBe(false);
  });

  it('enables when both username and secret are present', () => {
    const r = new BadgeReporter({ username: 'u', secret: 's', logger: () => {} });
    expect(r.isEnabled()).toBe(true);
  });

  it('respects explicit disabled=true', () => {
    const r = new BadgeReporter({
      username: 'u',
      secret: 's',
      enabled: false,
      logger: () => {},
    });
    expect(r.isEnabled()).toBe(false);
  });

  it('returns disabled result when disabled', async () => {
    const r = new BadgeReporter({ logger: () => {} });
    const result = await r.report({ level: 1 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('disabled');
  });

  it('POSTs HMAC-signed request when enabled and accepted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, badgesEarned: [1] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const r = new BadgeReporter({
      username: 'ahmed',
      secret: 'wbh-test',
      apiBase: 'https://test.api',
      logger: () => {},
    });
    const result = await r.report({ level: 1, agentName: 'Dudu' });

    expect(result.ok).toBe(true);
    expect(result.badgesEarned).toEqual([1]);
    expect(fetchSpy).toHaveBeenCalledOnce();

    const call = fetchSpy.mock.calls[0];
    const url = call?.[0];
    const init = call?.[1];

    expect(url).toBe('https://test.api/api/builders/ahmed/badge');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^HMAC [a-f0-9]{64}$/);
    expect(headers['X-Builder']).toBe('ahmed');
    expect(headers['X-Builder-Secret']).toBe('wbh-test');
    expect(headers['X-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const sentBody = JSON.parse(init?.body as string);
    expect(sentBody.level).toBe(1);
    expect(sentBody.agentName).toBe('Dudu');
  });

  it('returns ok=false when the API rejects the badge', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_secret' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const r = new BadgeReporter({
      username: 'ahmed',
      secret: 'wbh-bad',
      logger: () => {},
    });
    const result = await r.report({ level: 1 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_secret');
  });

  it('handles network failure gracefully (does not throw)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const r = new BadgeReporter({
      username: 'ahmed',
      secret: 'wbh-test',
      logger: () => {},
    });
    const result = await r.report({ level: 1 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ECONNREFUSED');
  });

  it('omits optional fields from the body when not provided', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, badgesEarned: [1] }), { status: 200 }),
      );

    const r = new BadgeReporter({
      username: 'u',
      secret: 's',
      logger: () => {},
    });
    await r.report({ level: 1 });

    const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual({ level: 1 });
    expect(body.agentName).toBeUndefined();
    expect(body.region).toBeUndefined();
  });

  it('includes Level 4 deployment payload', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, badgesEarned: [1, 2, 3, 4] }), { status: 200 }),
      );

    const r = new BadgeReporter({
      username: 'ahmed',
      secret: 'wbh-test',
      logger: () => {},
    });
    await r.report({
      level: 4,
      agentName: 'Dudu',
      region: 'us-central1',
      publicAgentUrl: 'https://adkclaw-abc.run.app',
      evidence: 'Deployed via adkclaw level 4',
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(body.level).toBe(4);
    expect(body.region).toBe('us-central1');
    expect(body.publicAgentUrl).toBe('https://adkclaw-abc.run.app');
  });

  it('fireAndForget does not block', () => {
    const r = new BadgeReporter({
      username: 'u',
      secret: 's',
      logger: () => {},
    });
    // Should return synchronously
    const start = Date.now();
    r.fireAndForget({ level: 1 });
    expect(Date.now() - start).toBeLessThan(10);
  });

  it('produces deterministic HMAC signatures for same inputs', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const headers = (init as RequestInit)?.headers as Record<string, string>;
      const auth = headers['Authorization'] ?? '';
      calls.push(auth);
      return new Response(JSON.stringify({ ok: true, badgesEarned: [1] }), { status: 200 });
    });

    const r = new BadgeReporter({
      username: 'u',
      secret: 's',
      logger: () => {},
    });

    // Lock time so two posts produce identical signatures
    vi.setSystemTime(new Date('2026-05-04T13:00:00.000Z'));
    await r.report({ level: 1 });
    await r.report({ level: 1 });

    expect(calls[0]).toBe(calls[1]);
  });
});
