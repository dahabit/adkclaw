// src/lib/logger.ts
//
// Structured JSON logging for Cloud Logging, with PII redacted at the boundary
// — Cloud Logging indexes everything for 30 days, so an email or token in a
// tool result must never reach stdout in the clear.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;
const TOKEN_RE = /\b(sk-|pk-|ya29\.|AIza|gho_|ghs_)[A-Za-z0-9_-]{16,}/g;
const CARD_RE = /\b(?:\d[ -]*?){13,16}\b/g;

export function redactPII(input: unknown): unknown {
  if (typeof input === 'string') {
    return input
      .replace(EMAIL_RE, '[email]')
      .replace(PHONE_RE, '[phone]')
      .replace(TOKEN_RE, '[token]')
      .replace(CARD_RE, '[card]');
  }
  if (Array.isArray(input)) return input.map(redactPII);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = redactPII(v);
    return out;
  }
  return input;
}

type Severity = 'INFO' | 'WARNING' | 'ERROR';

function emit(severity: Severity, message: string, fields: Record<string, unknown>): void {
  const stream = severity === 'ERROR' ? console.error : console.log;
  stream(
    JSON.stringify({
      severity,
      message: redactPII(message) as string,
      timestamp: new Date().toISOString(),
      ...(redactPII(fields) as Record<string, unknown>),
    }),
  );
}

export const logInfo = (msg: string, fields: Record<string, unknown> = {}): void =>
  emit('INFO', msg, fields);
export const logWarn = (msg: string, fields: Record<string, unknown> = {}): void =>
  emit('WARNING', msg, fields);
export const logError = (msg: string, fields: Record<string, unknown> = {}): void =>
  emit('ERROR', msg, fields);
