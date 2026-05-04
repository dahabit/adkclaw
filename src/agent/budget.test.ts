import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetGuard } from './budget.js';
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
