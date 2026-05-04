/**
 * src/sessions/store.ts — SQLite Persistence Layer.
 *
 * Built in Codelab 1, extended in Codelab 2 (compaction checkpoints) and
 * Codelab 3 (cron tables).
 *
 * Why SQLite (better-sqlite3)?
 *   - Embedded — no separate server process, zero ops
 *   - Synchronous API — atomic writes without juggling promises in the hot path
 *   - Battle-tested for single-host workloads — handles agent state cleanly
 *   - File-based — `cp data/adkclaw.db backup.db` is your backup strategy
 *
 * Workshop 4 (Cloud) introduces a Firestore adapter behind the same interface,
 * so the rest of the agent doesn't notice the swap.
 *
 * Tables (5):
 *
 *   sessions
 *     One row per active conversation thread.
 *     Key format: <channel>:<senderId>  (e.g. "telegram:5025183377", "cli:local")
 *     Sub-agent sessions: "subagent:<parent-key>:<id>" with kind='isolated'.
 *
 *   messages
 *     Append-only. One row per turn (user / assistant / function / system).
 *     Carries token counts + tool-call traces for the audit trail.
 *
 *   compaction_checkpoints
 *     One row per compaction event. Records: which messages were compacted,
 *     the resulting summary, and the token count saved. The audit trail for
 *     "what did the agent forget?"
 *
 *   cron_jobs
 *     Persistent schedule. Survives daemon restart. Each row has a cron
 *     expression, prompt, target channel/id, quiet-hours config.
 *
 *   cron_runs
 *     Append-only log of fired jobs. UNIQUE(idempotency_key) prevents
 *     missed-tick double-fires (key = "<jobId>:<floor(ms/60000)>").
 *
 * The session key is the linchpin: same channel + same senderId → same agent
 * memory across all interactions, regardless of HTTP / Telegram / CLI.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Session,
  SessionCreateInput,
  SessionKind,
  Message,
  MessageInput,
  MessageRole,
} from '../types/index.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    key TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'main',
    parent_key TEXT,
    channel TEXT,
    target TEXT,
    sender_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_message_at INTEGER,
    model TEXT DEFAULT 'gemini-2.5-pro',
    total_tokens INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL REFERENCES sessions(key),
    role TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    tool_args TEXT,
    tool_result TEXT,
    tokens INTEGER,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key, created_at);

  CREATE TABLE IF NOT EXISTS compaction_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    original_message_count INTEGER,
    summarized_message_ids TEXT,
    tokens_before INTEGER,
    tokens_after INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT,
    schedule_kind TEXT NOT NULL,
    schedule TEXT NOT NULL,
    task TEXT NOT NULL,
    session_key TEXT,
    channel TEXT,
    target TEXT,
    enabled INTEGER DEFAULT 1,
    idempotency_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_run_at INTEGER,
    next_run_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS cron_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    fired_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL,
    result TEXT,
    error TEXT,
    idempotency_key TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_runs_idem
    ON cron_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_id, fired_at);
`;

interface SessionRow {
  key: string;
  kind: string;
  parent_key: string | null;
  channel: string | null;
  target: string | null;
  sender_id: string | null;
  created_at: number;
  updated_at: number;
  last_message_at: number | null;
  model: string;
  total_tokens: number;
  is_archived: number;
}

interface MessageRow {
  id: number;
  session_key: string;
  role: string;
  content: string | null;
  tool_name: string | null;
  tool_args: string | null;
  tool_result: string | null;
  tokens: number | null;
  metadata: string | null;
  created_at: number;
}

function rowToSession(r: SessionRow): Session {
  return {
    key: r.key,
    kind: r.kind as SessionKind,
    parentKey: r.parent_key,
    channel: r.channel,
    target: r.target,
    senderId: r.sender_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastMessageAt: r.last_message_at,
    model: r.model,
    totalTokens: r.total_tokens,
    isArchived: r.is_archived === 1,
  };
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    sessionKey: r.session_key,
    role: r.role as MessageRole,
    content: r.content,
    toolName: r.tool_name,
    toolArgs: r.tool_args,
    toolResult: r.tool_result,
    tokens: r.tokens,
    metadata: r.metadata,
    createdAt: r.created_at,
  };
}

export interface SessionStoreOptions {
  databasePath: string;
  defaultModel?: string;
}

export class SessionStore {
  private db: Database.Database;
  private defaultModel: string;

  constructor(opts: SessionStoreOptions) {
    if (opts.databasePath !== ':memory:') {
      mkdirSync(dirname(opts.databasePath), { recursive: true });
    }
    this.db = new Database(opts.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);
    this.defaultModel = opts.defaultModel ?? 'gemini-2.5-pro';
  }

  close(): void {
    this.db.close();
  }

  /** Direct DB access — used by other subsystems (e.g. CronEngine) that need their own queries on the shared schema. */
  getDatabase(): Database.Database {
    return this.db;
  }

  createSession(input: SessionCreateInput): Session {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO sessions (
           key, kind, parent_key, channel, target, sender_id,
           created_at, updated_at, model, total_tokens, is_archived
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
         ON CONFLICT(key) DO NOTHING`,
      )
      .run(
        input.key,
        input.kind ?? 'main',
        input.parentKey ?? null,
        input.channel ?? null,
        input.target ?? null,
        input.senderId ?? null,
        now,
        now,
        input.model ?? this.defaultModel,
      );

    const session = this.getSession(input.key);
    if (!session) throw new Error(`Failed to create session ${input.key}`);
    return session;
  }

  getOrCreateSession(input: SessionCreateInput): Session {
    return this.getSession(input.key) ?? this.createSession(input);
  }

  getSession(key: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE key = ?').get(key) as
      | SessionRow
      | undefined;
    return row ? rowToSession(row) : null;
  }

  listSessions(opts?: { includeArchived?: boolean; limit?: number }): Session[] {
    const where = opts?.includeArchived ? '' : 'WHERE is_archived = 0';
    const limit = opts?.limit ?? 100;
    const rows = this.db
      .prepare(`SELECT * FROM sessions ${where} ORDER BY updated_at DESC LIMIT ?`)
      .all(limit) as SessionRow[];
    return rows.map(rowToSession);
  }

  archiveSession(key: string): void {
    this.db
      .prepare('UPDATE sessions SET is_archived = 1, updated_at = ? WHERE key = ?')
      .run(Date.now(), key);
  }

  deleteSession(key: string): void {
    const tx = this.db.transaction((k: string) => {
      this.db.prepare('DELETE FROM messages WHERE session_key = ?').run(k);
      this.db.prepare('DELETE FROM sessions WHERE key = ?').run(k);
    });
    tx(key);
  }

  appendMessage(input: MessageInput): Message {
    const now = Date.now();
    const toolArgs =
      input.toolArgs !== undefined && input.toolArgs !== null
        ? JSON.stringify(input.toolArgs)
        : null;
    const toolResult =
      input.toolResult !== undefined && input.toolResult !== null
        ? JSON.stringify(input.toolResult)
        : null;
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const tokens = input.tokens ?? 0;

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO messages (
             session_key, role, content, tool_name, tool_args, tool_result,
             tokens, metadata, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.sessionKey,
          input.role,
          input.content ?? null,
          input.toolName ?? null,
          toolArgs,
          toolResult,
          input.tokens ?? null,
          metadata,
          now,
        );

      this.db
        .prepare(
          `UPDATE sessions
             SET updated_at = ?, last_message_at = ?, total_tokens = total_tokens + ?
             WHERE key = ?`,
        )
        .run(now, now, tokens, input.sessionKey);

      return Number(result.lastInsertRowid);
    });
    const id = tx();

    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow;
    return rowToMessage(row);
  }

  listMessages(sessionKey: string, opts?: { limit?: number; sinceId?: number }): Message[] {
    const limit = opts?.limit ?? 1000;
    const sinceId = opts?.sinceId ?? 0;
    const rows = this.db
      .prepare(
        `SELECT * FROM messages
           WHERE session_key = ? AND id > ?
           ORDER BY id ASC
           LIMIT ?`,
      )
      .all(sessionKey, sinceId, limit) as MessageRow[];
    return rows.map(rowToMessage);
  }

  countMessages(sessionKey: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM messages WHERE session_key = ?')
      .get(sessionKey) as { n: number };
    return row.n;
  }

  getTokensSince(sessionKey: string, sinceMs: number): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(tokens), 0) AS sum
           FROM messages WHERE session_key = ? AND created_at >= ?`,
      )
      .get(sessionKey, sinceMs) as { sum: number };
    return row.sum;
  }

  getDailyTokensForSender(senderId: string, sinceMs: number): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(m.tokens), 0) AS sum
           FROM messages m
           JOIN sessions s ON s.key = m.session_key
           WHERE s.sender_id = ? AND m.created_at >= ?`,
      )
      .get(senderId, sinceMs) as { sum: number };
    return row.sum;
  }

  // === Compaction checkpoints ===

  createCheckpoint(input: {
    sessionKey: string;
    summary: string;
    summarizedMessageIds: number[];
    tokensBefore: number;
    tokensAfter: number;
  }): CompactionCheckpoint {
    const now = Date.now();
    const result = this.db
      .prepare(
        `INSERT INTO compaction_checkpoints (
           session_key, summary, original_message_count, summarized_message_ids,
           tokens_before, tokens_after, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.sessionKey,
        input.summary,
        input.summarizedMessageIds.length,
        JSON.stringify(input.summarizedMessageIds),
        input.tokensBefore,
        input.tokensAfter,
        now,
      );
    const id = Number(result.lastInsertRowid);
    return {
      id,
      sessionKey: input.sessionKey,
      summary: input.summary,
      summarizedMessageIds: input.summarizedMessageIds,
      originalMessageCount: input.summarizedMessageIds.length,
      tokensBefore: input.tokensBefore,
      tokensAfter: input.tokensAfter,
      createdAt: now,
    };
  }

  getLatestCheckpoint(sessionKey: string): CompactionCheckpoint | null {
    const row = this.db
      .prepare(
        `SELECT * FROM compaction_checkpoints
           WHERE session_key = ?
           ORDER BY created_at DESC
           LIMIT 1`,
      )
      .get(sessionKey) as
      | {
          id: number;
          session_key: string;
          summary: string;
          original_message_count: number;
          summarized_message_ids: string;
          tokens_before: number;
          tokens_after: number;
          created_at: number;
        }
      | undefined;
    if (!row) return null;
    let ids: number[] = [];
    try {
      const parsed = JSON.parse(row.summarized_message_ids);
      if (Array.isArray(parsed)) ids = parsed.map((n) => Number(n)).filter(Number.isFinite);
    } catch {
      ids = [];
    }
    return {
      id: row.id,
      sessionKey: row.session_key,
      summary: row.summary,
      summarizedMessageIds: ids,
      originalMessageCount: row.original_message_count,
      tokensBefore: row.tokens_before,
      tokensAfter: row.tokens_after,
      createdAt: row.created_at,
    };
  }
}

export interface CompactionCheckpoint {
  id: number;
  sessionKey: string;
  summary: string;
  summarizedMessageIds: number[];
  originalMessageCount: number;
  tokensBefore: number;
  tokensAfter: number;
  createdAt: number;
}
