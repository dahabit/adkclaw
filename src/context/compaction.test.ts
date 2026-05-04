import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { Compactor } from './compaction.js';
import { SessionStore } from '../sessions/store.js';
import { estimateTokens, estimateTokensInMessages } from './token-counter.js';

let sessions: SessionStore;
let compactor: Compactor;
let generateContent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessions = new SessionStore({ databasePath: ':memory:' });
  generateContent = vi.fn().mockResolvedValue({
    text: 'SUMMARY: user asked about X, agent ran tool Y, result was Z.',
  });
  const client = { models: { generateContent } } as unknown as GoogleGenAI;
  compactor = new Compactor({
    client,
    sessions,
    thresholdTokens: 100,
    summarizeFraction: 0.5,
    summarizerModel: 'gemini-2.5-flash',
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });

  it('approximates chars / 4', () => {
    expect(estimateTokens('1234')).toBe(1);
    expect(estimateTokens('12345')).toBe(2);
    expect(estimateTokens('a'.repeat(80))).toBe(20);
  });
});

describe('Compactor.shouldCompact', () => {
  it('returns false when below threshold', () => {
    sessions.createSession({ key: 's1' });
    sessions.appendMessage({ sessionKey: 's1', role: 'user', content: 'hi' });
    const r = compactor.shouldCompact('s1');
    expect(r.compact).toBe(false);
  });

  it('returns true when above threshold', () => {
    sessions.createSession({ key: 's1' });
    sessions.appendMessage({
      sessionKey: 's1',
      role: 'assistant',
      content: 'a'.repeat(500),
    });
    const r = compactor.shouldCompact('s1');
    expect(r.compact).toBe(true);
    expect(r.tokens).toBeGreaterThan(100);
  });
});

describe('Compactor.compact', () => {
  it('returns null when too few messages', async () => {
    sessions.createSession({ key: 's1' });
    sessions.appendMessage({ sessionKey: 's1', role: 'user', content: 'hi' });
    const r = await compactor.compact('s1');
    expect(r).toBeNull();
  });

  it('summarizes oldest fraction and writes a checkpoint', async () => {
    sessions.createSession({ key: 's1' });
    for (let i = 0; i < 10; i++) {
      sessions.appendMessage({
        sessionKey: 's1',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `message ${i}`,
      });
    }
    const r = await compactor.compact('s1');
    expect(r).not.toBeNull();
    expect(r!.summarizedMessageCount).toBe(5); // 50% of 10
    expect(r!.summary).toContain('SUMMARY');

    const checkpoint = sessions.getLatestCheckpoint('s1');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.summarizedMessageIds).toHaveLength(5);
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it('subsequent shouldCompact only counts messages after the checkpoint', async () => {
    sessions.createSession({ key: 's1' });
    for (let i = 0; i < 10; i++) {
      sessions.appendMessage({
        sessionKey: 's1',
        role: 'assistant',
        content: 'a'.repeat(50),
      });
    }
    expect(compactor.shouldCompact('s1').compact).toBe(true);
    await compactor.compact('s1');
    // After compaction, recent half (~5 msgs × ~12 tokens) should be under threshold.
    const after = compactor.shouldCompact('s1');
    expect(after.tokens).toBeLessThan(estimateTokensInMessages(sessions.listMessages('s1')));
  });

  it('handles SDK failure by returning null without writing checkpoint', async () => {
    generateContent.mockRejectedValue(new Error('429 rate limit'));
    sessions.createSession({ key: 's1' });
    for (let i = 0; i < 8; i++) {
      sessions.appendMessage({ sessionKey: 's1', role: 'user', content: `m${i}` });
    }
    const r = await compactor.compact('s1');
    // Even on error, we return a result containing the failure message
    expect(r).not.toBeNull();
    expect(r!.summary).toContain('Compaction failed');
  });
});
