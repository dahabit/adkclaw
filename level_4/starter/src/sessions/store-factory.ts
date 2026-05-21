// src/sessions/store-factory.ts
//
// Picks the session backend by env. Local dev uses SQLite; Cloud Run sets
// SESSION_BACKEND=firestore so state survives a stateless, scale-to-zero
// container.
import { SqliteSessionStore, type SessionStore } from './store.js';
import { FirestoreSessionStore } from './firestore-store.js';

export function createSessionStore(databasePath: string): SessionStore {
  if (process.env['SESSION_BACKEND'] === 'firestore') {
    return new FirestoreSessionStore();
  }
  return new SqliteSessionStore(databasePath);
}
