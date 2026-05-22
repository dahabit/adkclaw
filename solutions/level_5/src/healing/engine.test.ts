import { describe, it, expect, vi } from 'vitest';
import { HealingEngine } from './engine.js';

describe('HealingEngine.withRetry', () => {
  it('returns immediately on success', async () => {
    const engine = new HealingEngine();
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await engine.withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on retryable error and succeeds', async () => {
    const engine = new HealingEngine();
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 2) throw Object.assign(new Error('Service Unavailable'), { status: 503 });
      return 'ok';
    });
    const onRetry = vi.fn();
    const result = await engine.withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1, onRetry });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('throws immediately on non-retryable error', async () => {
    const engine = new HealingEngine();
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    await expect(engine.withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('gives up after maxAttempts', async () => {
    const engine = new HealingEngine();
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 503 }));
    await expect(
      engine.withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('HealingEngine.withFallback', () => {
  it('returns primary result when primary succeeds', async () => {
    const engine = new HealingEngine();
    const primary = vi.fn().mockResolvedValue('A');
    const fallback = vi.fn().mockResolvedValue('B');
    const r = await engine.withFallback(primary, fallback);
    expect(r.result).toBe('A');
    expect(r.usedFallback).toBe(false);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back on retryable failure', async () => {
    const engine = new HealingEngine();
    const primary = vi.fn().mockRejectedValue(Object.assign(new Error('500'), { status: 500 }));
    const fallback = vi.fn().mockResolvedValue('B');
    const r = await engine.withFallback(primary, fallback);
    expect(r.result).toBe('B');
    expect(r.usedFallback).toBe(true);
  });

  it('does not fall back on auth errors', async () => {
    const engine = new HealingEngine();
    const primary = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const fallback = vi.fn().mockResolvedValue('B');
    await expect(engine.withFallback(primary, fallback)).rejects.toThrow('Unauthorized');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('respects custom skipFallbackFor list', async () => {
    const engine = new HealingEngine();
    const primary = vi.fn().mockRejectedValue(Object.assign(new Error('500'), { status: 500 }));
    const fallback = vi.fn().mockResolvedValue('B');
    await expect(
      engine.withFallback(primary, fallback, { skipFallbackFor: ['serverError'] }),
    ).rejects.toThrow('500');
  });
});

describe('HealingEngine.protect', () => {
  it('retries primary first, then falls back', async () => {
    const engine = new HealingEngine();
    let primaryCalls = 0;
    const primary = vi.fn().mockImplementation(async () => {
      primaryCalls += 1;
      throw Object.assign(new Error('500'), { status: 500 });
    });
    const fallback = vi.fn().mockResolvedValue('B');
    const r = await engine.protect(primary, fallback, {
      maxAttempts: 2,
      baseDelayMs: 1,
      maxDelayMs: 1,
    });
    expect(r.result).toBe('B');
    expect(r.usedFallback).toBe(true);
    expect(primaryCalls).toBe(2);
  });
});
