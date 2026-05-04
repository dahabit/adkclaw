/**
 * Unit tests for HMAC-based builder authentication.
 */

import { describe, it, expect } from 'vitest';
import {
  generateBuilderSecret,
  hashSecret,
  verifySecret,
  signMessage,
  verifySignature,
} from './auth.js';

describe('generateBuilderSecret', () => {
  it('returns a wbh-prefixed hex string', () => {
    const s = generateBuilderSecret();
    expect(s).toMatch(/^wbh-[a-f0-9]{64}$/);
  });

  it('returns unique values', () => {
    const a = generateBuilderSecret();
    const b = generateBuilderSecret();
    expect(a).not.toBe(b);
  });
});

describe('hashSecret + verifySecret', () => {
  it('verifies the correct secret', async () => {
    const plaintext = 'wbh-abc123';
    const hash = await hashSecret(plaintext);
    expect(await verifySecret(plaintext, hash)).toBe(true);
  });

  it('rejects an incorrect secret', async () => {
    const hash = await hashSecret('correct');
    expect(await verifySecret('wrong', hash)).toBe(false);
  });

  it('produces different hashes for same input (bcrypt salting)', async () => {
    const plaintext = 'same-input';
    const h1 = await hashSecret(plaintext);
    const h2 = await hashSecret(plaintext);
    expect(h1).not.toBe(h2);
    expect(await verifySecret(plaintext, h1)).toBe(true);
    expect(await verifySecret(plaintext, h2)).toBe(true);
  });
});

describe('signMessage', () => {
  it('produces a 64-char hex SHA-256 HMAC', () => {
    const sig = signMessage('secret', '1:2026-05-04T00:00:00.000Z');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for same inputs', () => {
    const a = signMessage('s', 'm');
    const b = signMessage('s', 'm');
    expect(a).toBe(b);
  });

  it('changes when secret changes', () => {
    const a = signMessage('s1', 'm');
    const b = signMessage('s2', 'm');
    expect(a).not.toBe(b);
  });

  it('changes when message changes', () => {
    const a = signMessage('s', 'm1');
    const b = signMessage('s', 'm2');
    expect(a).not.toBe(b);
  });
});

describe('verifySignature', () => {
  const secret = 'wbh-deadbeef';

  it('accepts a valid signature within the replay window', () => {
    const ts = new Date().toISOString();
    const sig = signMessage(secret, `1:${ts}`);
    const result = verifySignature({ secret, level: 1, timestampIso: ts, signature: sig });
    expect(result.ok).toBe(true);
  });

  it('rejects a signature with the wrong secret', () => {
    const ts = new Date().toISOString();
    const sig = signMessage('different-secret', `1:${ts}`);
    const result = verifySignature({ secret, level: 1, timestampIso: ts, signature: sig });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_signature');
  });

  it('rejects a signature for the wrong level', () => {
    const ts = new Date().toISOString();
    const sig = signMessage(secret, `1:${ts}`);
    const result = verifySignature({ secret, level: 2, timestampIso: ts, signature: sig });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_signature');
  });

  it('rejects a stale timestamp (> 5 min skew)', () => {
    const oldTs = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const sig = signMessage(secret, `1:${oldTs}`);
    const result = verifySignature({ secret, level: 1, timestampIso: oldTs, signature: sig });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timestamp_skew');
  });

  it('rejects a malformed timestamp', () => {
    const sig = signMessage(secret, '1:not-a-date');
    const result = verifySignature({
      secret,
      level: 1,
      timestampIso: 'not-a-date',
      signature: sig,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('malformed_timestamp');
  });

  it('rejects a signature of the wrong length', () => {
    const ts = new Date().toISOString();
    const result = verifySignature({
      secret,
      level: 1,
      timestampIso: ts,
      signature: 'short',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_signature');
  });
});
