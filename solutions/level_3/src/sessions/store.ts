// src/sessions/store.ts
import Database, { type Database as DB } from 'better-sqlite3';
import type { Content } from '@google/genai';
import type { Session, SessionKind } from '../types/index.js';

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

// DDL run statement-by-statement on startup. SQLite's CREATE ... IF NOT
// EXISTS makes this idempotent — safe to run on every boot.
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
  `CREATE TABLE IF NOT EXISTS cron_jobs (
     id TEXT PRIMARY KEY,
     name TEXT,
     schedule_kind TEXT NOT NULL DEFAULT 'cron',
     schedule TEXT NOT NULL,
     task TEXT NOT NULL,
     session_key TEXT,
     channel TEXT,
     target TEXT,
     enabled INTEGER NOT NULL DEFAULT 1,
     idempotency_key TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     last_run_at INTEGER,
     next_run_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS cron_runs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     job_id TEXT NOT NULL,
     fired_at INTEGER NOT NULL,
     completed_at INTEGER,
     status TEXT NOT NULL,
     result TEXT,
     error TEXT,
     idempotency_key TEXT
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_runs_idem ON cron_runs(idempotency_key)`,
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

export class SessionStore {
  private readonly db: DB;

  constructor(databasePath: string) {
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    for (const statement of SCHEMA) {
      this.db.prepare(statement).run();
    }
  }

  /** The underlying better-sqlite3 handle — shared with the CronEngine. */
  getDatabase(): DB {
    return this.db;
  }

  // Session keys are `<channel>:<senderId>`. `kind` is 'main' for top-level
  // conversations and 'isolated' for sub-agent children (linked via parentKey).
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

  /** Mark a session archived — used to retire sub-agent children after spawn. */
  archiveSession(key: string): void {
    this.db.prepare(`UPDATE sessions SET archived = 1 WHERE key = ?`).run(key);
  }

  /** Active (non-archived) sessions, most-recently-updated first — for the dashboard. */
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

  // Compaction: delete the oldest `count` messages and insert one summary
  // message in the oldest slot, so chronological history order is preserved.
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
