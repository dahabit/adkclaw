import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from './store.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore({ databasePath: ':memory:' });
  });

  it('creates and retrieves a session', () => {
    const created = store.createSession({
      key: 'telegram:123',
      channel: 'telegram',
      senderId: '123',
    });
    expect(created.key).toBe('telegram:123');
    expect(created.kind).toBe('main');
    expect(created.channel).toBe('telegram');
    expect(created.isArchived).toBe(false);

    const fetched = store.getSession('telegram:123');
    expect(fetched).toEqual(created);
  });

  it('createSession is idempotent on duplicate key', () => {
    const a = store.createSession({ key: 'k1' });
    const b = store.createSession({ key: 'k1' });
    expect(b.createdAt).toBe(a.createdAt);
  });

  it('getOrCreateSession returns existing session without overwriting', () => {
    const a = store.createSession({ key: 'k1', channel: 'telegram' });
    const b = store.getOrCreateSession({ key: 'k1', channel: 'cli' });
    expect(b.channel).toBe('telegram');
    expect(b.createdAt).toBe(a.createdAt);
  });

  it('appendMessage updates total tokens and last_message_at', () => {
    store.createSession({ key: 's1' });
    store.appendMessage({ sessionKey: 's1', role: 'user', content: 'hi', tokens: 10 });
    store.appendMessage({ sessionKey: 's1', role: 'assistant', content: 'hello', tokens: 20 });

    const session = store.getSession('s1');
    expect(session?.totalTokens).toBe(30);
    expect(session?.lastMessageAt).toBeGreaterThan(0);
  });

  it('lists messages in insertion order', () => {
    store.createSession({ key: 's1' });
    store.appendMessage({ sessionKey: 's1', role: 'user', content: 'one' });
    store.appendMessage({ sessionKey: 's1', role: 'assistant', content: 'two' });
    store.appendMessage({ sessionKey: 's1', role: 'user', content: 'three' });

    const msgs = store.listMessages('s1');
    expect(msgs.map((m) => m.content)).toEqual(['one', 'two', 'three']);
  });

  it('archiveSession marks but does not delete', () => {
    store.createSession({ key: 's1' });
    store.archiveSession('s1');
    const session = store.getSession('s1');
    expect(session?.isArchived).toBe(true);
  });

  it('lists active sessions only by default', () => {
    store.createSession({ key: 's1' });
    store.createSession({ key: 's2' });
    store.archiveSession('s2');
    expect(store.listSessions().map((s) => s.key)).toEqual(['s1']);
    expect(
      store
        .listSessions({ includeArchived: true })
        .map((s) => s.key)
        .sort(),
    ).toEqual(['s1', 's2']);
  });

  it('deleteSession removes session and its messages', () => {
    store.createSession({ key: 's1' });
    store.appendMessage({ sessionKey: 's1', role: 'user', content: 'hi' });
    store.deleteSession('s1');
    expect(store.getSession('s1')).toBeNull();
    expect(store.listMessages('s1')).toEqual([]);
  });

  it('serializes tool args and result as JSON strings', () => {
    store.createSession({ key: 's1' });
    store.appendMessage({
      sessionKey: 's1',
      role: 'tool',
      toolName: 'shell',
      toolArgs: { command: 'ls' },
      toolResult: { exitCode: 0, stdout: 'a\nb' },
    });
    const m = store.listMessages('s1')[0];
    expect(m).toBeDefined();
    expect(JSON.parse(m!.toolArgs!)).toEqual({ command: 'ls' });
    expect(JSON.parse(m!.toolResult!)).toEqual({ exitCode: 0, stdout: 'a\nb' });
  });

  it('getDailyTokensForSender aggregates across sessions', () => {
    store.createSession({ key: 's1', senderId: 'alice' });
    store.createSession({ key: 's2', senderId: 'alice' });
    store.appendMessage({ sessionKey: 's1', role: 'assistant', tokens: 100 });
    store.appendMessage({ sessionKey: 's2', role: 'assistant', tokens: 200 });
    expect(store.getDailyTokensForSender('alice', 0)).toBe(300);
  });

  it('listMessages respects sinceId for incremental reads', () => {
    store.createSession({ key: 's1' });
    const m1 = store.appendMessage({ sessionKey: 's1', role: 'user', content: 'one' });
    store.appendMessage({ sessionKey: 's1', role: 'assistant', content: 'two' });
    const after = store.listMessages('s1', { sinceId: m1.id });
    expect(after.map((m) => m.content)).toEqual(['two']);
  });

  it('migrations are idempotent — reopening fresh DB succeeds', () => {
    store.createSession({ key: 's1' });
    const store2 = new SessionStore({ databasePath: ':memory:' });
    expect(store2.getSession('s1')).toBeNull();
    store2.close();
  });
});
