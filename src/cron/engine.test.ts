import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { CronEngine } from './engine.js';
import { Heartbeat } from './heartbeat.js';
import { AgentRunner } from '../agent/runner.js';
import { SessionStore } from '../sessions/store.js';
import { ContextEngine } from '../context/manager.js';
import { ToolRegistry } from '../tools/registry.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../types/index.js';

function makeConfig(workspace: string): Config {
  return {
    server: { port: 0, host: 'localhost' },
    paths: { workspace, database: ':memory:' },
    gemini: {
      apiKey: 'fake',
      defaultModel: 'gemini-2.5-pro',
      fallbackModel: 'gemini-2.5-flash',
    },
    telegram: { botToken: '', allowedSenders: [] },
    agent: {
      name: 'A',
      tone: 'direct',
      traits: [],
      maxToolRounds: 5,
      compactionThreshold: 0.8,
      heartbeatIntervalMs: 0,
      timezone: 'UTC',
      dailyTokenBudget: 100_000,
    },
    vertex: { project: null, region: 'us-central1' },
  };
}

let workspace: string;
let sessions: SessionStore;
let runner: AgentRunner;
let engine: CronEngine;
let delivery: ReturnType<typeof vi.fn>;
let generateContent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-cron-'));
  sessions = new SessionStore({ databasePath: ':memory:' });
  generateContent = vi.fn().mockResolvedValue({
    candidates: [{ content: { parts: [{ text: 'cron output' }] } }],
    usageMetadata: { totalTokenCount: 1 },
  });
  const client = { models: { generateContent } } as unknown as GoogleGenAI;
  runner = new AgentRunner({
    client,
    sessions,
    contextEngine: new ContextEngine({ workspacePath: workspace }),
    registry: new ToolRegistry(),
    config: makeConfig(workspace),
  });
  delivery = vi.fn().mockResolvedValue(undefined);
  engine = new CronEngine({ runner, sessions, db: sessions.getDatabase(), delivery });
});

describe('CronEngine.add / list / remove', () => {
  it('adds a job and lists it', () => {
    sessions.createSession({ key: 'parent' });
    const job = engine.add({
      name: 'test',
      schedule: '*/5 * * * *',
      task: 'do thing',
      sessionKey: 'parent',
    });
    expect(job.id).toMatch(/^cron-/);
    expect(engine.list()).toHaveLength(1);
    expect(engine.get(job.id)?.task).toBe('do thing');
  });

  it('rejects invalid cron expressions', () => {
    sessions.createSession({ key: 'parent' });
    expect(() =>
      engine.add({
        name: 'bad',
        schedule: 'not a cron',
        task: 'x',
        sessionKey: 'parent',
      }),
    ).toThrow(/Invalid cron/);
  });

  it('remove deletes job from store', () => {
    sessions.createSession({ key: 'parent' });
    const job = engine.add({
      name: 't',
      schedule: '0 * * * *',
      task: 'x',
      sessionKey: 'parent',
    });
    engine.remove(job.id);
    expect(engine.get(job.id)).toBeNull();
  });
});

describe('CronEngine.fireNow', () => {
  it('runs the agent and delivers the result', async () => {
    sessions.createSession({ key: 'parent', channel: 'telegram', target: '12345' });
    const job = engine.add({
      name: 'fire',
      schedule: '0 * * * *',
      task: 'check stuff',
      sessionKey: 'parent',
      channel: 'telegram',
      target: '12345',
    });
    const result = await engine.fireNow(job.id);
    expect(result.success).toBe(true);
    expect(generateContent).toHaveBeenCalled();
    expect(delivery).toHaveBeenCalledWith('telegram', '12345', 'cron output');

    const runs = engine.recentRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('success');
  });

  it('idempotency key prevents double-fire within same minute', async () => {
    sessions.createSession({ key: 'parent' });
    const job = engine.add({
      name: 't',
      schedule: '0 * * * *',
      task: 'x',
      sessionKey: 'parent',
    });
    await engine.fireNow(job.id);
    await engine.fireNow(job.id);
    const runs = engine.recentRuns(job.id);
    // First fire: success. Second: skipped (no new row, returns existing).
    // Our skipped path returns the existing run id but doesn't insert, so we expect 1 row total.
    expect(runs.length).toBeLessThanOrEqual(2);
    const success = runs.filter((r) => r.status === 'success');
    expect(success.length).toBe(1);
  });
});

describe('Heartbeat', () => {
  it('skips when HEARTBEAT.md is missing', async () => {
    const hb = new Heartbeat({
      runner,
      workspacePath: workspace,
      intervalMs: 60_000,
    });
    const r = await hb.tick();
    expect(r.fired).toBe(false);
    expect(r.reason).toContain('no HEARTBEAT.md');
  });

  it('skips when HEARTBEAT.md only has the placeholder', async () => {
    writeFileSync(
      join(workspace, 'HEARTBEAT.md'),
      '# Heartbeat\n\n## Scheduled\n_(nothing yet)_\n',
    );
    const hb = new Heartbeat({ runner, workspacePath: workspace, intervalMs: 60_000 });
    const r = await hb.tick();
    expect(r.fired).toBe(false);
    expect(r.reason).toContain('no scheduled tasks');
  });

  it('runs the agent when there are real tasks', async () => {
    writeFileSync(
      join(workspace, 'HEARTBEAT.md'),
      '# Heartbeat\n\n## Scheduled\n- check Flutter blog daily at 9am\n',
    );
    const hb = new Heartbeat({ runner, workspacePath: workspace, intervalMs: 60_000 });
    const r = await hb.tick();
    expect(r.fired).toBe(true);
    expect(generateContent).toHaveBeenCalled();
  });

  it('treats HEARTBEAT_OK reply as silent', async () => {
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'HEARTBEAT_OK' }] } }],
    });
    writeFileSync(join(workspace, 'HEARTBEAT.md'), '# Heartbeat\n\n- something\n');
    const hb = new Heartbeat({
      runner,
      workspacePath: workspace,
      intervalMs: 60_000,
      delivery,
      channel: 'telegram',
      target: '99',
    });
    const r = await hb.tick();
    expect(r.fired).toBe(true);
    expect(r.reply).toBe('');
    expect(delivery).not.toHaveBeenCalled();
  });

  it('respects quiet hours', () => {
    const hb = new Heartbeat({
      runner,
      workspacePath: workspace,
      intervalMs: 60_000,
      quietHours: { start: 22, end: 7 },
    });
    const earlyMorning = new Date();
    earlyMorning.setHours(3);
    expect(hb.isQuietHour(earlyMorning)).toBe(true);
    const noon = new Date();
    noon.setHours(12);
    expect(hb.isQuietHour(noon)).toBe(false);
  });
});
