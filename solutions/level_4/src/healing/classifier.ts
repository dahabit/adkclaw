import type { ClassifiedError, ErrorType } from './types.js';

/**
 * Classify an arbitrary error into one of our handled types.
 *
 * Uses heuristics on the error message + status code. Intended to handle:
 *   - Gemini SDK errors (ApiError-shaped)
 *   - HTTP fetch errors (TypeError, AbortError)
 *   - Node system errors (ENOTFOUND, ECONNRESET, etc.)
 *   - Plain Error objects with descriptive messages
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err === null || err === undefined) {
    return { type: 'unknown', message: 'null error', retryable: false };
  }

  const e = err as { message?: unknown; status?: unknown; code?: unknown; name?: unknown };
  const message =
    typeof e.message === 'string' ? e.message : typeof err === 'string' ? err : JSON.stringify(err);
  const lower = message.toLowerCase();
  const status = typeof e.status === 'number' ? e.status : undefined;
  const code = typeof e.code === 'string' ? e.code : undefined;
  const name = typeof e.name === 'string' ? e.name : undefined;

  // 401/403 → auth/permission
  if (status === 401 || /api[\s_-]?key|unauthorized|invalid.*credential/.test(lower)) {
    return { type: 'auth', message, retryable: false, status: status ?? 401 };
  }
  if (status === 403 || /forbidden|permission denied/.test(lower)) {
    return { type: 'permission', message, retryable: false, status: status ?? 403 };
  }
  if (status === 404 || /not found/.test(lower)) {
    return { type: 'notFound', message, retryable: false, status: status ?? 404 };
  }

  // Rate limit
  if (status === 429 || /rate[\s_-]?limit|quota|too many requests/.test(lower)) {
    const retryAfterMs = parseRetryAfter(message);
    return {
      type: 'rateLimit',
      message,
      retryable: true,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      ...(status !== undefined ? { status } : { status: 429 }),
    };
  }

  // Server errors → retryable
  if ((status !== undefined && status >= 500 && status < 600) || /5\d\d|server error/.test(lower)) {
    return {
      type: 'serverError',
      message,
      retryable: true,
      ...(status !== undefined ? { status } : {}),
    };
  }

  // Timeouts
  if (name === 'AbortError' || code === 'ETIMEDOUT' || /timeout|timed out|deadline/.test(lower)) {
    return { type: 'timeout', message, retryable: true };
  }

  // Network errors
  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    name === 'FetchError' ||
    /network|fetch failed|socket hang up/.test(lower)
  ) {
    return { type: 'network', message, retryable: true };
  }

  // Process / subsystem crash
  if (/crash|killed|sigsegv|segmentation/.test(lower)) {
    return { type: 'crash', message, retryable: true };
  }

  return {
    type: 'unknown',
    message,
    retryable: false,
    ...(status !== undefined ? { status } : {}),
  };
}

function parseRetryAfter(message: string): number | undefined {
  const m = message.match(/retry[\s-]?after[:\s]+(\d+)\s*(s|sec|seconds|ms)?/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const unit = m[2]?.toLowerCase();
  return unit === 'ms' ? n : n * 1000;
}

export function describe(c: ClassifiedError): string {
  const status = c.status ? ` (status ${c.status})` : '';
  const retry = c.retryable ? ' [retryable]' : '';
  return `${c.type}${status}${retry}: ${c.message}`;
}

export type { ErrorType };
