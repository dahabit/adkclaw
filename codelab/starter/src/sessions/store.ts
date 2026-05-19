// src/sessions/store.ts
import Database, { type Database as DB } from 'better-sqlite3';
import type { Content } from '@google/genai';
import type { Session, SessionKind } from '../types/index.js';

// SessionStore is an interface so the runtime can swap backends — SQLite for
// local dev, Firestore for Cloud Run (see firestore-store.ts + store-factory.ts).
export interface SessionStore {
  ensureSession(
    key: string,
    channel: string | null,
    senderId: string | null,
    model: string,
    kind?: SessionKind,
    parentKey?: string | null,
  ): Session;
  archiveSession(key: string): void;
  listSessions(model?: string): Session[];
  history(sessionKey: string): Content[];
  appendAll(sessionKey: string, contents: Content[]): void;
  replaceWithSummary(sessionKey: string, count: number, summary: string): void;
}

interface SessionRow {
  key: string;
  channel: string | null;
  sender_id: string | null;
  kind: string;
  parent_key: string | null;
  archived: number;
  created_at: number;
  updated_at: number;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sessions (
     key TEXT PRIMARY KEY,
     channel TEXT,
     sender_id TEXT,
     kind TEXT NOT NULL DEFAULT 'main',
     parent_key TEXT,
     archived INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     session_key TEXT NOT NULL,
     role TEXT NOT NULL,
     content_json TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key)`,
];

function rowToSession(row: SessionRow, model: string): Session {
  return {
    key: row.key,
    kind: (row.kind as SessionKind) || 'main',
    parentKey: row.parent_key,
    channel: row.channel,
    target: row.sender_id,
    senderId: row.sender_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: null,
    model,
    totalTokens: 0,
    isArchived: row.archived === 1,
  };
}

/** SQLite-backed SessionStore — the local-dev / single-host backend. */
export class SqliteSessionStore implements SessionStore {
  private readonly db: DB;

  constructor(databasePath: string) {
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    for (const statement of SCHEMA) {
      this.db.prepare(statement).run();
    }
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
    this.db
      .prepare(
        `INSERT OR IGNORE INTO sessions
           (key, channel, sender_id, kind, parent_key, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(key, channel, senderId, kind, parentKey, now, now);
    const row = this.db.prepare(`SELECT * FROM sessions WHERE key = ?`).get(key) as SessionRow;
    return rowToSession(row, model);
  }

  archiveSession(key: string): void {
    this.db.prepare(`UPDATE sessions SET archived = 1 WHERE key = ?`).run(key);
  }

  listSessions(model = ''): Session[] {
    const rows = this.db
      .prepare(`SELECT * FROM sessions WHERE archived = 0 ORDER BY updated_at DESC LIMIT 50`)
      .all() as SessionRow[];
    return rows.map((r) => rowToSession(r, model));
  }

  history(sessionKey: string): Content[] {
    const rows = this.db
      .prepare(`SELECT content_json FROM messages WHERE session_key = ? ORDER BY id ASC`)
      .all(sessionKey) as Array<{ content_json: string }>;
    return rows.map((r) => JSON.parse(r.content_json) as Content);
  }

  appendAll(sessionKey: string, contents: Content[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO messages (session_key, role, content_json, created_at) VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    const tx = this.db.transaction(() => {
      for (const c of contents) {
        stmt.run(sessionKey, c.role ?? 'user', JSON.stringify(c), now);
      }
      this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE key = ?`).run(now, sessionKey);
    });
    tx();
  }

  replaceWithSummary(sessionKey: string, count: number, summary: string): void {
    const rows = this.db
      .prepare(`SELECT id FROM messages WHERE session_key = ? ORDER BY id ASC LIMIT ?`)
      .all(sessionKey, count) as Array<{ id: number }>;
    if (rows.length === 0) return;
    const summaryId = rows[0]?.id;
    if (summaryId === undefined) return;

    const summaryContent: Content = {
      role: 'user',
      parts: [{ text: `[Summary of earlier turns]\n${summary}` }],
    };
    const now = Date.now();
    const del = this.db.prepare(`DELETE FROM messages WHERE id = ?`);
    const ins = this.db.prepare(
      `INSERT INTO messages (id, session_key, role, content_json, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      for (const r of rows) del.run(r.id);
      ins.run(summaryId, sessionKey, 'user', JSON.stringify(summaryContent), now);
    });
    tx();
  }
}
