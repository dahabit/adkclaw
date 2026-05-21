// src/sessions/firestore-store.ts
//
// Firestore-backed SessionStore for Cloud Run. Firestore I/O is async, but the
// agent runner expects synchronous reads — so reads are served from an
// in-memory buffer (prefetch via loadSession), and writes are fire-and-forget
// write-through. This is the "buffer reads at session start" strategy.
//
// NOTE: verified by typecheck only — exercising it needs the Firestore
// emulator or a real GCP project.
import { Firestore } from '@google-cloud/firestore';
import type { Content } from '@google/genai';
import type { Session, SessionKind } from '../types/index.js';
import type { SessionStore } from './store.js';

export class FirestoreSessionStore implements SessionStore {
  private readonly db: Firestore;
  private readonly buffers = new Map<string, Content[]>();
  private readonly meta = new Map<string, Session>();

  constructor() {
    this.db = new Firestore();
  }

  /** Prefetch a session's message history into the buffer. Call before a turn. */
  async loadSession(sessionKey: string): Promise<void> {
    //REPLACE-FIRESTORE-LOAD
    // Prefetch the most-recent 200 messages from Firestore into the in-memory
    // buffer. On failure, fall back to an empty buffer so the turn still runs.
    // From level_4/codelab.md §5 "Firestore session adapter".
    void sessionKey;
    throw new Error('REPLACE-FIRESTORE-LOAD not implemented — see level_4/codelab.md §5');
  }

  ensureSession(
    key: string,
    channel: string | null,
    senderId: string | null,
    model: string,
    kind: SessionKind = 'main',
    parentKey: string | null = null,
  ): Session {
    const now = Date.now();
    const session: Session = {
      key,
      kind,
      parentKey,
      channel,
      target: senderId,
      senderId,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
      model,
      totalTokens: 0,
      isArchived: false,
    };
    this.meta.set(key, session);
    if (!this.buffers.has(key)) this.buffers.set(key, []);
    void this.db
      .collection('sessions')
      .doc(key)
      .set(
        { key, channel, senderId, kind, parentKey, createdAt: now, archived: false },
        { merge: true },
      );
    return session;
  }

  archiveSession(key: string): void {
    const m = this.meta.get(key);
    if (m) m.isArchived = true;
    void this.db.collection('sessions').doc(key).set({ archived: true }, { merge: true });
  }

  listSessions(_model = ''): Session[] {
    return [...this.meta.values()].filter((s) => !s.isArchived);
  }

  history(sessionKey: string): Content[] {
    return this.buffers.get(sessionKey) ?? [];
  }

  appendAll(sessionKey: string, contents: Content[]): void {
    const buf = this.buffers.get(sessionKey) ?? [];
    buf.push(...contents);
    this.buffers.set(sessionKey, buf);
    const col = this.db.collection('sessions').doc(sessionKey).collection('messages');
    const now = Date.now();
    for (const c of contents) {
      void col.doc().set({ role: c.role ?? 'user', content: c, createdAt: now });
    }
  }

  replaceWithSummary(sessionKey: string, count: number, summary: string): void {
    const buf = this.buffers.get(sessionKey) ?? [];
    const summaryContent: Content = {
      role: 'user',
      parts: [{ text: `[Summary of earlier turns]\n${summary}` }],
    };
    // The buffer is the active view; Firestore message docs stay append-only.
    this.buffers.set(sessionKey, [summaryContent, ...buf.slice(count)]);
  }
}
