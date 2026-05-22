/**
 * `adkclaw migrate` — guided SQLite → Firestore migration helper.
 *
 * Reads sessions + messages from `data/adkclaw.db` and prints `gcloud firestore`
 * import-format JSON to stdout. Operator pipes to `gcloud firestore documents create`
 * or imports via the bulk loader.
 *
 * Doesn't perform writes itself — migrations should be reviewable.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface SessionRow {
  key: string;
  channel: string | null;
  target: string | null;
  senderId: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  model: string;
  totalTokens: number;
  isArchived: number;
}

interface MessageRow {
  id: number;
  sessionKey: string;
  role: string;
  content: string;
  toolName: string | null;
  toolArgs: string | null;
  toolResult: string | null;
  tokensIn: number;
  tokensOut: number;
  createdAt: number;
}

export function migrate(): number {
  const dbPath = resolve(process.cwd(), 'data/adkclaw.db');
  if (!existsSync(dbPath)) {
    console.error(`No SQLite DB found at ${dbPath}. Nothing to migrate.`);
    return 1;
  }

  const db = new Database(dbPath, { readonly: true });
  const sessions = db.prepare('SELECT * FROM sessions').all() as SessionRow[];
  const messages = db.prepare('SELECT * FROM messages').all() as MessageRow[];

  console.log('# Sessions');
  for (const s of sessions) {
    console.log(JSON.stringify({ collection: 'sessions', id: s.key, doc: s }));
  }
  console.log('# Messages');
  for (const m of messages) {
    console.log(JSON.stringify({ collection: 'messages', id: String(m.id), doc: m }));
  }

  console.error(
    `\nExported ${sessions.length} sessions + ${messages.length} messages.\n` +
      'Pipe stdout into your Firestore import script (see level_5/codelab.md §5).',
  );
  db.close();
  return 0;
}
