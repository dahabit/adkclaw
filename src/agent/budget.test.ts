import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BudgetGuard, assertDailyTokenBudget } from './budget.js';
import { SessionStore } from '../sessions/store.js';

let sessions: SessionStore;
let guard: BudgetGuard;

beforeEach(() => {
  sessions = new SessionStore({ databasePath: ':memory:' });
  guard = new BudgetGuard({
    sessions,
    dailyTokenBudget: 1000,
    startOfDayMs: () => 0, // count everything
  });
});

describe('BudgetGuard', () => {
  it('allows when under budget', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 100 });
    const r = guard.check('alice');
    expect(r.ok).toBe(true);
    expect(r.usedToday).toBe(100);
  });

  it('refuses when at or over budget', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 1000 });
    const r = guard.check('alice');
    expect(r.ok).toBe(false);
    expect(r.refusalText).toContain('Daily token budget');
    expect(r.refusalText).toContain('1,000');
  });

  it('aggregates across sessions for the same sender', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.createSession({ key: 's2', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 600 });
    sessions.appendMessage({ sessionKey: 's2', role: 'assistant', tokens: 500 });
    const r = guard.check('alice');
    expect(r.ok).toBe(false);
    expect(r.usedToday).toBe(1100);
  });

  it('isolates per sender', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.createSession({ key: 's2', senderId: 'bob' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 1500 });
    const aliceCheck = guard.check('alice');
    const bobCheck = guard.check('bob');
    expect(aliceCheck.ok).toBe(false);
    expect(bobCheck.ok).toBe(true);
  });

  it('passes through when no senderId', () => {
    const r = guard.check(null);
    expect(r.ok).toBe(true);
  });

  it('passes through when budget is 0 or negative (disabled)', () => {
    const noLimit = new BudgetGuard({
      sessions,
      dailyTokenBudget: 0,
      startOfDayMs: () => 0,
    });
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 1_000_000 });
    const r = noLimit.check('alice');
    expect(r.ok).toBe(true);
  });
});

describe('assertDailyTokenBudget', () => {
  const original = process.env.DAILY_TOKEN_BUDGET;

  afterEach(() => {
    process.env.DAILY_TOKEN_BUDGET = original;
  });

  it('throws when DAILY_TOKEN_BUDGET is not set', () => {
    const current = process.env.DAILY_TOKEN_BUDGET;
    delete process.env.DAILY_TOKEN_BUDGET;
    try {
      expect(() => assertDailyTokenBudget()).toThrow('DAILY_TOKEN_BUDGET is required');
    } finally {
      process.env.DAILY_TOKEN_BUDGET = current;
    }
  });

  it('throws when DAILY_TOKEN_BUDGET is not a valid number', () => {
    process.env.DAILY_TOKEN_BUDGET = 'not-a-number';
    expect(() => assertDailyTokenBudget()).toThrow('must be a number >= 1000');
  });

  it('throws when DAILY_TOKEN_BUDGET is below minimum (1000)', () => {
    process.env.DAILY_TOKEN_BUDGET = '999';
    expect(() => assertDailyTokenBudget()).toThrow('must be a number >= 1000');
  });

  it('returns the budget when valid', () => {
    process.env.DAILY_TOKEN_BUDGET = '100000';
    expect(assertDailyTokenBudget()).toBe(100000);
  });

  it('returns the budget when above minimum', () => {
    process.env.DAILY_TOKEN_BUDGET = '1000';
    expect(assertDailyTokenBudget()).toBe(1000);
  });
});

describe('BudgetGuard percentage calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessions = new SessionStore({ databasePath: ':memory:' });
  });

  it('calculates usage percentage in refusal message', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 800 });
    const guard = new BudgetGuard({
      sessions,
      dailyTokenBudget: 1000,
      startOfDayMs: () => 0,
    });
    const r = guard.check('alice');
    expect(r.ok).toBe(true); // 800 < 1000, still under budget
    // Check that it doesn't have a refusal (still OK)
    expect(r.refusalText).toBeUndefined();
  });

  it('handles edge case of exactly 100% usage', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 1000 });
    const guard = new BudgetGuard({
      sessions,
      dailyTokenBudget: 1000,
      startOfDayMs: () => 0,
    });
    const r = guard.check('alice');
    expect(r.ok).toBe(false); // 1000 >= 1000, at budget
    expect(r.refusalText).toContain('100%');
  });

  it('rounds percentage to nearest integer', () => {
    sessions.createSession({ key: 's1', senderId: 'alice' });
    sessions.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 1100 });
    const guard = new BudgetGuard({
      sessions,
      dailyTokenBudget: 1000,
      startOfDayMs: () => 0,
    });
    const r = guard.check('alice');
    expect(r.ok).toBe(false); // 1100 >= 1000, over budget
    // 1100/1000 = 110%, rounds to 110%
    expect(r.refusalText).toContain('110%');
  });
});
