// src/sessions/store.ts
import Database, { type Database as DB } from 'better-sqlite3';
import type { Content } from '@google/genai';
import type { Session } from '../types/index.js';

interface SessionRow {
  key: string;
  channel: string | null;
  sender_id: string | null;
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

  // Session keys are `<channel>:<senderId>` — same agent, multiple users,
  // no leakage between them.
  ensureSession(
    key: string,
    channel: string | null,
    senderId: string | null,
    model: string,
  ): Session {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO sessions (key, channel, sender_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(key, channel, senderId, now, now);

    const row = this.db.prepare(`SELECT * FROM sessions WHERE key = ?`).get(key) as SessionRow;

    return {
      key: row.key,
      kind: 'main',
      parentKey: null,
      channel: row.channel,
      target: row.sender_id,
      senderId: row.sender_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: null,
      model,
      totalTokens: 0,
      isArchived: false,
    };
  }

  //REPLACE-SESSION-STORE
  // Retrieve message history and append messages to the session store.
  // Fill this in from level_2/codelab.md §6.
  history(sessionKey: string): Content[] {
    throw new Error('REPLACE-SESSION-STORE not implemented — see level_2/codelab.md §6');
  }

  appendAll(sessionKey: string, contents: Content[]): void {
    throw new Error('REPLACE-SESSION-STORE not implemented — see level_2/codelab.md §6');
  }
}
