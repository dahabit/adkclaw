import { describe, it, expect, afterEach, vi } from 'vitest';
import { assertDailyTokenBudget, BudgetGuard } from './budget.js';

describe('assertDailyTokenBudget', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('throws when DAILY_TOKEN_BUDGET is unset', () => {
    vi.stubEnv('DAILY_TOKEN_BUDGET', '');
    expect(() => assertDailyTokenBudget()).toThrow(/required/);
  });

  it('throws when the budget is below the 1000 floor', () => {
    vi.stubEnv('DAILY_TOKEN_BUDGET', '500');
    expect(() => assertDailyTokenBudget()).toThrow(/>= 1000/);
  });

  it('returns the parsed budget when valid', () => {
    vi.stubEnv('DAILY_TOKEN_BUDGET', '100000');
    expect(assertDailyTokenBudget()).toBe(100000);
  });
});

describe('BudgetGuard', () => {
  it('allows a sender under budget', () => {
    const guard = new BudgetGuard({ dailyTokenBudget: 1000 });
    guard.record('u1', 400);
    expect(guard.check('u1').ok).toBe(true);
  });

  it('refuses a sender over budget with a clear message', () => {
    const guard = new BudgetGuard({ dailyTokenBudget: 1000 });
    guard.record('u1', 1200);
    const verdict = guard.check('u1');
    expect(verdict.ok).toBe(false);
    expect(verdict.refusalText).toContain('budget reached');
  });

  it('does not cap an anonymous (null) sender', () => {
    const guard = new BudgetGuard({ dailyTokenBudget: 10 });
    guard.record('u1', 999);
    expect(guard.check(null).ok).toBe(true);
  });
});
