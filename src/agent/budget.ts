import type { SessionStore } from '../sessions/store.js';

export interface BudgetCheck {
  ok: boolean;
  usedToday: number;
  budget: number;
  refusalText?: string;
}

export interface BudgetGuardOptions {
  sessions: SessionStore;
  dailyTokenBudget: number;
  /**
   * Returns the start-of-day timestamp (ms) for "today" in the agent's timezone.
   * Defaults to UTC midnight.
   */
  startOfDayMs?: () => number;
}

function utcMidnight(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
}

/**
 * Validate DAILY_TOKEN_BUDGET at startup. Throws if unset or invalid.
 *
 * There is no safe default. A silent fallback (e.g., 500_000) hides the missing
 * config and produces the $400 surprise bill. Per Level 5 hardening: missing
 * config is a structural bug, not a runtime quirk.
 *
 * Call this once at daemon startup, BEFORE constructing BudgetGuard.
 */
export function assertDailyTokenBudget(): number {
  const raw = process.env.DAILY_TOKEN_BUDGET;
  if (!raw) {
    throw new Error(
      'DAILY_TOKEN_BUDGET is required. Set it explicitly in .env (recommended: 100000 single user, 500000 team).',
    );
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) {
    throw new Error(`DAILY_TOKEN_BUDGET must be a number >= 1000, got: ${raw}`);
  }
  return n;
}

/**
 * BudgetGuard — per-sender daily token cap.
 *
 * Inspect the messages table for tokens spent by `senderId` since start-of-day.
 * If over budget, refuse the turn with a clear message — no silent failure.
 *
 * The cap protects against runaway costs from compromised credentials, infinite
 * tool loops, or just an unusually heavy day.
 */
export class BudgetGuard {
  private readonly sessions: SessionStore;
  private readonly dailyTokenBudget: number;
  private readonly startOfDayMs: () => number;

  constructor(opts: BudgetGuardOptions) {
    this.sessions = opts.sessions;
    this.dailyTokenBudget = opts.dailyTokenBudget;
    this.startOfDayMs = opts.startOfDayMs ?? utcMidnight;
  }

  check(senderId: string | null | undefined): BudgetCheck {
    const budget = this.dailyTokenBudget;
    if (!senderId || budget <= 0) {
      return { ok: true, usedToday: 0, budget };
    }
    const usedToday = this.sessions.getDailyTokensForSender(senderId, this.startOfDayMs());
    if (usedToday >= budget) {
      const pct = Math.round((usedToday / budget) * 100);
      return {
        ok: false,
        usedToday,
        budget,
        refusalText: `Daily token budget reached (${usedToday.toLocaleString()} / ${budget.toLocaleString()}, ${pct}%). I'm pausing until UTC midnight to avoid runaway costs. You can raise DAILY_TOKEN_BUDGET in .env if this is intentional.`,
      };
    }
    return { ok: true, usedToday, budget };
  }
}
