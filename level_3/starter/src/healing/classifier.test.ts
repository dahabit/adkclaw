import { describe, it, expect } from 'vitest';
import { classifyError } from './classifier.js';

describe('classifyError', () => {
  it('classifies 401 as auth, non-retryable', () => {
    const c = classifyError({ status: 401, message: 'Unauthorized' });
    expect(c.type).toBe('auth');
    expect(c.retryable).toBe(false);
  });

  it('classifies "API key not valid" message as auth', () => {
    const c = classifyError(new Error('API key not valid'));
    expect(c.type).toBe('auth');
  });

  it('classifies 403 as permission', () => {
    const c = classifyError({ status: 403, message: 'Forbidden' });
    expect(c.type).toBe('permission');
    expect(c.retryable).toBe(false);
  });

  it('classifies 429 as rateLimit, retryable', () => {
    const c = classifyError({ status: 429, message: 'Quota exceeded' });
    expect(c.type).toBe('rateLimit');
    expect(c.retryable).toBe(true);
  });

  it('parses retry-after from message', () => {
    const c = classifyError(new Error('Rate limit. retry-after: 5s'));
    expect(c.type).toBe('rateLimit');
    expect(c.retryAfterMs).toBe(5000);
  });

  it('classifies 503 as serverError, retryable', () => {
    const c = classifyError({ status: 503, message: 'Service Unavailable' });
    expect(c.type).toBe('serverError');
    expect(c.retryable).toBe(true);
  });

  it('classifies AbortError as timeout', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    const c = classifyError(err);
    expect(c.type).toBe('timeout');
    expect(c.retryable).toBe(true);
  });

  it('classifies ENOTFOUND as network', () => {
    const c = classifyError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' });
    expect(c.type).toBe('network');
    expect(c.retryable).toBe(true);
  });

  it('classifies ECONNRESET as network', () => {
    const c = classifyError({ code: 'ECONNRESET', message: 'socket hang up' });
    expect(c.type).toBe('network');
  });

  it('falls back to unknown for unclassifiable errors', () => {
    const c = classifyError(new Error('something weird'));
    expect(c.type).toBe('unknown');
    expect(c.retryable).toBe(false);
  });

  it('handles non-Error throws', () => {
    expect(classifyError('string thrown').type).toBe('unknown');
    expect(classifyError(null).type).toBe('unknown');
    expect(classifyError(undefined).type).toBe('unknown');
  });
});
