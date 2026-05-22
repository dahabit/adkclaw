/**
 * src/healing/engine.ts — The Recovery Pyramid.
 *
 * "The agent never crashes." That's the brand promise. This file enforces it.
 *
 * Built in Codelab 3 (The Agent Army). The five-tier pyramid (BRD §12.1):
 *
 *     ESCALATE   ↑ surface a clear message to the user (nothing else worked)
 *      DEGRADE   ↑ continue with reduced capability ("answering from training data only")
 *       RECOVER  ↑ restart subsystem (handled at channel/cron level — not here)
 *       FALLBACK ↑ swap primary for alternative (Pro → Flash, browser → web_fetch)
 *       RETRY    ↑ exponential backoff for transient errors (1s → 2s → 4s)
 *
 * What this file provides:
 *
 *   - withRetry(fn, opts)    → retry transient errors with exponential backoff
 *   - withFallback(p, f)     → if primary throws (non-skip), use fallback
 *   - protect(p, f, opts)    → combo: retry the primary, then fallback if all retries fail
 *
 * What this file does NOT do:
 *
 *   - Decide WHICH errors are transient — see src/healing/classifier.ts
 *   - Decide WHEN to escalate to the user — that's the caller's choice
 *   - Restart subsystems — the channel adapter / cron engine handle that themselves
 *
 * The agent runner wraps every Gemini call in protect() so 5xx errors fall back from
 * Pro → Flash silently, while auth errors escalate immediately (auth never recovers
 * from retry — see classifier.ts skip list).
 */

import { classifyError, describe } from './classifier.js';
import type { ClassifiedError, FallbackOptions, RetryOptions } from './types.js';

const DEFAULT_RETRY: Required<Pick<RetryOptions, 'maxAttempts' | 'baseDelayMs' | 'maxDelayMs'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * HealingEngine — recovery primitives for the agent runtime.
 *
 *   Pyramid (BRD §12.1):
 *     RETRY    → exponential backoff for transient errors
 *     FALLBACK → swap primary for alternative (Pro → Flash, Playwright → web_fetch)
 *     RECOVER  → restart subsystem (handled at the channel/cron level, not here)
 *     DEGRADE  → continue with less capability (caller decides)
 *     ESCALATE → surface a clear message to the user
 */
export class HealingEngine {
  async withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
    const max = opts.maxAttempts ?? DEFAULT_RETRY.maxAttempts;
    const base = opts.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
    const cap = opts.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const classified = classifyError(e);
        if (!classified.retryable || attempt === max) {
          throw e;
        }
        const expBackoff = Math.min(base * 2 ** (attempt - 1), cap);
        const waitMs = classified.retryAfterMs ?? expBackoff;
        opts.onRetry?.({ attempt, error: classified, waitMs });
        await sleep(waitMs);
      }
    }
    throw lastErr;
  }

  async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    opts: FallbackOptions = {},
  ): Promise<{ result: T; usedFallback: boolean; error?: ClassifiedError }> {
    try {
      const result = await primary();
      return { result, usedFallback: false };
    } catch (e) {
      const classified = classifyError(e);
      const skip = opts.skipFallbackFor ?? ['auth', 'permission'];
      if (skip.includes(classified.type)) {
        throw e;
      }
      opts.onFallback?.({ error: classified });
      const result = await fallback();
      return { result, usedFallback: true, error: classified };
    }
  }

  /**
   * Combo: retry the primary; if all retries fail with non-skip errors, fall back.
   */
  async protect<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    opts: RetryOptions & FallbackOptions = {},
  ): Promise<{ result: T; usedFallback: boolean }> {
    return this.withFallback(() => this.withRetry(primary, opts), fallback, opts);
  }
}

export { classifyError, describe };
export type { ClassifiedError } from './types.js';
