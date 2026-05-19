import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrate.js';

describe('migrate', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'adkclaw-migrate-'));
    process.chdir(tmpDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 1 when no database exists', () => {
    const code = migrate();
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No SQLite DB found'));
  });

  it('exports sessions in Firestore import format', () => {
    const dbDir = join(tmpDir, 'data');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'adkclaw.db');
    mkdirSync(dbDir, { recursive: true });
    const db = new Database(dbPath);
    db.prepare(
      `
      CREATE TABLE sessions (
        key TEXT PRIMARY KEY,
        channel TEXT,
        target TEXT,
        senderId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        lastMessageAt INTEGER,
        model TEXT,
        totalTokens INTEGER,
        isArchived INTEGER
      )
    `,
    ).run();
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      's1',
      'telegram',
      null,
      '123',
      1000,
      1000,
      1100,
      'gemini-2.5-pro',
      500,
      0,
    );
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      's2',
      'cli',
      null,
      null,
      2000,
      2000,
      null,
      'gemini-2.5-pro',
      0,
      1,
    );
    db.prepare(
      `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        sessionKey TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolArgs TEXT,
        toolResult TEXT,
        tokensIn INTEGER,
        tokensOut INTEGER,
        createdAt INTEGER
      )
    `,
    ).run();
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      1,
      's1',
      'user',
      'hello',
      null,
      null,
      null,
      10,
      0,
      3000,
    );
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      2,
      's1',
      'assistant',
      'hi',
      null,
      null,
      null,
      0,
      20,
      3100,
    );
    db.close();

    const code = migrate();
    expect(code).toBe(0);

    // Check that sessions were exported
    const logCalls = logSpy.mock.calls.map((c) => String(c[0] ?? ''));
    const sessionLines = logCalls.filter((c) => c && c.includes('"collection":"sessions"'));
    expect(sessionLines.length).toBe(2);
    expect(sessionLines[0]).toContain('"id":"s1"');
    expect(sessionLines[0]).toContain('"channel":"telegram"');
    expect(sessionLines[1]).toContain('"id":"s2"');

    // Check that messages were exported
    const messageLines = logCalls.filter((c) => c && c.includes('"collection":"messages"'));
    expect(messageLines.length).toBe(2);
    expect(messageLines[0]).toContain('"role":"user"');
    expect(messageLines[1]).toContain('"role":"assistant"');
  });

  it('exports the correct total session and message count in stderr', () => {
    const dbDir = join(tmpDir, 'data');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'adkclaw.db');
    const db = new Database(dbPath);
    db.prepare(
      `
      CREATE TABLE sessions (
        key TEXT PRIMARY KEY,
        channel TEXT,
        target TEXT,
        senderId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        lastMessageAt INTEGER,
        model TEXT,
        totalTokens INTEGER,
        isArchived INTEGER
      )
    `,
    ).run();
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'a',
      'telegram',
      null,
      '1',
      1000,
      1000,
      null,
      'gemini-2.5-pro',
      0,
      0,
    );
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'b',
      'telegram',
      null,
      '2',
      1000,
      1000,
      null,
      'gemini-2.5-pro',
      0,
      0,
    );
    db.prepare(
      `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        sessionKey TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolArgs TEXT,
        toolResult TEXT,
        tokensIn INTEGER,
        tokensOut INTEGER,
        createdAt INTEGER
      )
    `,
    ).run();
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      1,
      'a',
      'user',
      'hi',
      null,
      null,
      null,
      0,
      0,
      1000,
    );
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      2,
      'a',
      'assistant',
      'hello',
      null,
      null,
      null,
      0,
      0,
      1010,
    );
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      3,
      'b',
      'user',
      'test',
      null,
      null,
      null,
      0,
      0,
      2000,
    );
    db.close();

    const code = migrate();
    expect(code).toBe(0);
    const errorCalls = errorSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(errorCalls).toContain('2 sessions');
    expect(errorCalls).toContain('3 messages');
  });

  it('handles empty database (zero sessions, zero messages)', () => {
    const dbDir = join(tmpDir, 'data');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'adkclaw.db');
    const db = new Database(dbPath);
    db.prepare(
      `
      CREATE TABLE sessions (
        key TEXT PRIMARY KEY,
        channel TEXT,
        target TEXT,
        senderId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        lastMessageAt INTEGER,
        model TEXT,
        totalTokens INTEGER,
        isArchived INTEGER
      )
    `,
    ).run();
    db.prepare(
      `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        sessionKey TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolArgs TEXT,
        toolResult TEXT,
        tokensIn INTEGER,
        tokensOut INTEGER,
        createdAt INTEGER
      )
    `,
    ).run();
    db.close();

    const code = migrate();
    expect(code).toBe(0);
    const errorCalls = errorSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(errorCalls).toContain('0 sessions');
    expect(errorCalls).toContain('0 messages');
  });

  it('outputs JSON per session in correct format', () => {
    const dbDir = join(tmpDir, 'data');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'adkclaw.db');
    const db = new Database(dbPath);
    db.prepare(
      `
      CREATE TABLE sessions (
        key TEXT PRIMARY KEY,
        channel TEXT,
        target TEXT,
        senderId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        lastMessageAt INTEGER,
        model TEXT,
        totalTokens INTEGER,
        isArchived INTEGER
      )
    `,
    ).run();
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'test-key',
      'telegram',
      null,
      '999',
      1609459200,
      1609459200,
      null,
      'gemini-2.5-pro',
      50,
      0,
    );
    db.prepare(
      `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        sessionKey TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolArgs TEXT,
        toolResult TEXT,
        tokensIn INTEGER,
        tokensOut INTEGER,
        createdAt INTEGER
      )
    `,
    ).run();
    db.close();

    migrate();

    const logCalls = logSpy.mock.calls.map((c) => String(c[0] ?? ''));
    const sessionLine = logCalls.find((c) => c && c.includes('"id":"test-key"'));
    expect(sessionLine).toBeDefined();

    const parsed = JSON.parse(sessionLine!);
    expect(parsed.collection).toBe('sessions');
    expect(parsed.id).toBe('test-key');
    expect(parsed.doc.channel).toBe('telegram');
    expect(parsed.doc.senderId).toBe('999');
    expect(parsed.doc.model).toBe('gemini-2.5-pro');
    expect(parsed.doc.totalTokens).toBe(50);
  });

  it('closes the database after export', () => {
    const dbDir = join(tmpDir, 'data');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'adkclaw.db');
    const db = new Database(dbPath);
    db.prepare(
      `
      CREATE TABLE sessions (
        key TEXT PRIMARY KEY,
        channel TEXT,
        target TEXT,
        senderId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        lastMessageAt INTEGER,
        model TEXT,
        totalTokens INTEGER,
        isArchived INTEGER
      )
    `,
    ).run();
    db.prepare(
      `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        sessionKey TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolArgs TEXT,
        toolResult TEXT,
        tokensIn INTEGER,
        tokensOut INTEGER,
        createdAt INTEGER
      )
    `,
    ).run();
    db.close();

    const code = migrate();
    expect(code).toBe(0);

    // Verify we can open the database again (proves it was closed properly)
    const db2 = new Database(dbPath, { readonly: true });
    const sessions = db2.prepare('SELECT COUNT(*) as cnt FROM sessions').all();
    expect(sessions).toBeDefined();
    db2.close();
  });

  it('includes section headers in output', () => {
    const dbDir = join(tmpDir, 'data');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'adkclaw.db');
    const db = new Database(dbPath);
    db.prepare(
      `
      CREATE TABLE sessions (
        key TEXT PRIMARY KEY,
        channel TEXT,
        target TEXT,
        senderId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        lastMessageAt INTEGER,
        model TEXT,
        totalTokens INTEGER,
        isArchived INTEGER
      )
    `,
    ).run();
    db.prepare(
      `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        sessionKey TEXT,
        role TEXT,
        content TEXT,
        toolName TEXT,
        toolArgs TEXT,
        toolResult TEXT,
        tokensIn INTEGER,
        tokensOut INTEGER,
        createdAt INTEGER
      )
    `,
    ).run();
    db.close();

    migrate();

    const logCalls = logSpy.mock.calls.map((c) => String(c[0] ?? ''));
    expect(logCalls).toContain('# Sessions');
    expect(logCalls).toContain('# Messages');
  });
});
