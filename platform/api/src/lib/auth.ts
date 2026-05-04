/**
 * HMAC-based authentication for builder badge POSTs.
 *
 * When a builder registers, we generate a random HMAC secret and return it
 * once (never retrievable again — we store only a bcrypt hash). The builder's
 * deployed agent uses this secret to sign POST /api/builders/:username/badge
 * requests.
 *
 * Signature scheme:
 *   message = `${level}:${timestamp}`
 *   signature = HMAC-SHA256(secret, message) → hex
 *   header: "Authorization: HMAC <signature>"
 *           "X-Builder: <username>"
 *           "X-Timestamp: <ISO 8601>"
 *
 * Replay protection: timestamp must be within ±300 seconds of server time.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const REPLAY_WINDOW_SEC = 300; // ±5 min

export function generateBuilderSecret(): string {
  // 32 random bytes → 64-char hex
  return 'wbh-' + crypto.randomBytes(32).toString('hex');
}

export async function hashSecret(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 10);
}

export async function verifySecret(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function signMessage(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export interface VerifySignatureParams {
  secret: string;
  level: number;
  timestampIso: string;
  signature: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: 'invalid_signature' | 'timestamp_skew' | 'malformed_timestamp';
}

export function verifySignature(params: VerifySignatureParams): VerifyResult {
  const ts = Date.parse(params.timestampIso);
  if (isNaN(ts)) return { ok: false, reason: 'malformed_timestamp' };

  const skewSec = Math.abs(Date.now() - ts) / 1000;
  if (skewSec > REPLAY_WINDOW_SEC) return { ok: false, reason: 'timestamp_skew' };

  const message = `${params.level}:${params.timestampIso}`;
  const expected = signMessage(params.secret, message);

  // constant-time comparison
  if (params.signature.length !== expected.length) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (!crypto.timingSafeEqual(Buffer.from(params.signature), Buffer.from(expected))) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true };
}
