// src/agent/budget.ts
//
// Level 5 hardening — the daily token cap. There is NO safe default: a silent
// fallback hides missing config and produces the surprise bill. Missing config
// is a structural bug, caught at startup.

/**
 * Validate DAILY_TOKEN_BUDGET at startup. Throws if unset or invalid — the
 * daemon must die before serving a request rather than run uncapped.
 */
export function assertDailyTokenBudget(): number {
  const raw = process.env['DAILY_TOKEN_BUDGET'];
  if (!raw) {
    throw new Error(
      'DAILY_TOKEN_BUDGET is required. Set it explicitly in .env ' +
        '(recommended: 100000 single user, 500000 team).',
    );
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) {
    throw new Error(`DAILY_TOKEN_BUDGET must be a number >= 1000, got: ${raw}`);
  }
  return n;
}

export interface BudgetCheck {
  ok: boolean;
  usedToday: number;
  budget: number;
  refusalText?: string;
}

/**
 * BudgetGuard — a per-sender daily token cap. The starter keeps usage in
 * memory (it resets on restart); the production reference tallies it from the
 * messages table so the cap survives a redeploy.
 */
export class BudgetGuard {
  private readonly dailyTokenBudget: number;
  private readonly usedBySender = new Map<string, number>();

  constructor(opts: { dailyTokenBudget: number }) {
    this.dailyTokenBudget = opts.dailyTokenBudget;
  }

  record(senderId: string | null | undefined, tokens: number): void {
    if (!senderId || tokens <= 0) return;
    this.usedBySender.set(senderId, (this.usedBySender.get(senderId) ?? 0) + tokens);
  }

  check(senderId: string | null | undefined): BudgetCheck {
    const budget = this.dailyTokenBudget;
    const usedToday = senderId ? (this.usedBySender.get(senderId) ?? 0) : 0;
    if (senderId && budget > 0 && usedToday >= budget) {
      const pct = Math.round((usedToday / budget) * 100);
      return {
        ok: false,
        usedToday,
        budget,
        refusalText:
          `Daily token budget reached (${usedToday.toLocaleString()} / ` +
          `${budget.toLocaleString()}, ${pct}%). Pausing to avoid runaway costs. ` +
          `Raise DAILY_TOKEN_BUDGET in .env if this is intentional.`,
      };
    }
    return { ok: true, usedToday, budget };
  }
}
