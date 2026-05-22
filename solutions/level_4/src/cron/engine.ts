import cron from 'node-cron';
import type { Database } from 'better-sqlite3';
import type { AgentRunner } from '../agent/runner.js';
import type { SessionStore } from '../sessions/store.js';
import type { ContextEngine } from '../context/manager.js';
import type { CronJob, CronJobInput, CronRun, DeliveryFn } from './types.js';

interface JobRow {
  id: string;
  name: string | null;
  schedule_kind: string;
  schedule: string;
  task: string;
  session_key: string | null;
  channel: string | null;
  target: string | null;
  enabled: number;
  idempotency_key: string | null;
  created_at: number;
  updated_at: number;
  last_run_at: number | null;
  next_run_at: number | null;
}

interface RunRow {
  id: number;
  job_id: string;
  fired_at: number;
  completed_at: number | null;
  status: string;
  result: string | null;
  error: string | null;
  idempotency_key: string | null;
}

function rowToJob(r: JobRow): CronJob {
  return {
    id: r.id,
    name: r.name,
    scheduleKind: r.schedule_kind as 'cron',
    schedule: r.schedule,
    task: r.task,
    sessionKey: r.session_key ?? '',
    channel: r.channel,
    target: r.target,
    enabled: r.enabled === 1,
    idempotencyKey: r.idempotency_key,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastRunAt: r.last_run_at,
    nextRunAt: r.next_run_at,
  };
}

function rowToRun(r: RunRow): CronRun {
  return {
    id: r.id,
    jobId: r.job_id,
    firedAt: r.fired_at,
    completedAt: r.completed_at,
    status: r.status as CronRun['status'],
    result: r.result,
    error: r.error,
    idempotencyKey: r.idempotency_key,
  };
}

function randomId(): string {
  return `cron-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bucketKey(jobId: string, fireMs: number): string {
  // 1-minute buckets — prevents double-fire when a tick straddles a restart.
  const minute = Math.floor(fireMs / 60_000);
  return `${jobId}:${minute}`;
}

export interface CronEngineOptions {
  runner: AgentRunner;
  sessions: SessionStore;
  contextEngine: ContextEngine;
  /** Model used for the session a fired job runs in. */
  model: string;
  /** Direct DB handle for cron-specific queries (the SessionStore owns the DB but we share). */
  db: Database;
  /** How the engine delivers an agent reply back to the user's channel. */
  delivery?: DeliveryFn;
}

/**
 * CronEngine — schedule + heartbeat orchestrator.
 *
 *   1. Jobs persist in `cron_jobs` (BRD §10.1, P2 schema).
 *   2. node-cron schedules them in-process. We re-load on `start()`.
 *   3. When a tick fires:
 *      a. Compute idempotency key (jobId + minute bucket); insert into cron_runs.
 *         Unique index ensures we only fire once per minute.
 *      b. Run the agent on jobTask in the linked session.
 *      c. Deliver the response via the channel callback.
 *      d. Mark cron_run as success/failed.
 */
export class CronEngine {
  private readonly runner: AgentRunner;
  private readonly sessions: SessionStore;
  private readonly contextEngine: ContextEngine;
  private readonly model: string;
  private readonly db: Database;
  private readonly delivery?: DeliveryFn;
  private readonly tasks = new Map<string, cron.ScheduledTask>();

  constructor(opts: CronEngineOptions) {
    this.runner = opts.runner;
    this.sessions = opts.sessions;
    this.contextEngine = opts.contextEngine;
    this.model = opts.model;
    this.db = opts.db;
    if (opts.delivery) this.delivery = opts.delivery;
  }

  add(input: CronJobInput): CronJob {
    if (!cron.validate(input.schedule)) {
      throw new Error(`Invalid cron expression: ${input.schedule}`);
    }
    const id = input.id ?? randomId();
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO cron_jobs (
           id, name, schedule_kind, schedule, task, session_key, channel, target,
           enabled, idempotency_key, created_at, updated_at, last_run_at, next_run_at
         ) VALUES (?, ?, 'cron', ?, ?, ?, ?, ?, 1, ?, ?, ?, NULL, NULL)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           schedule = excluded.schedule,
           task = excluded.task,
           session_key = excluded.session_key,
           channel = excluded.channel,
           target = excluded.target,
           enabled = 1,
           idempotency_key = excluded.idempotency_key,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.name ?? null,
        input.schedule,
        input.task,
        input.sessionKey,
        input.channel ?? null,
        input.target ?? null,
        input.idempotencyKey ?? null,
        now,
        now,
      );

    const job = this.get(id);
    if (!job) throw new Error('Failed to create cron job');
    this.scheduleTask(job);
    return job;
  }

  remove(id: string): void {
    this.unscheduleTask(id);
    this.db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(id);
  }

  disable(id: string): void {
    this.unscheduleTask(id);
    this.db
      .prepare('UPDATE cron_jobs SET enabled = 0, updated_at = ? WHERE id = ?')
      .run(Date.now(), id);
  }

  enable(id: string): void {
    this.db
      .prepare('UPDATE cron_jobs SET enabled = 1, updated_at = ? WHERE id = ?')
      .run(Date.now(), id);
    const job = this.get(id);
    if (job) this.scheduleTask(job);
  }

  get(id: string): CronJob | null {
    const row = this.db.prepare('SELECT * FROM cron_jobs WHERE id = ?').get(id) as
      | JobRow
      | undefined;
    return row ? rowToJob(row) : null;
  }

  list(): CronJob[] {
    const rows = this.db
      .prepare('SELECT * FROM cron_jobs ORDER BY created_at DESC')
      .all() as JobRow[];
    return rows.map(rowToJob);
  }

  recentRuns(jobId: string, limit = 20): CronRun[] {
    const rows = this.db
      .prepare(`SELECT * FROM cron_runs WHERE job_id = ? ORDER BY fired_at DESC LIMIT ?`)
      .all(jobId, limit) as RunRow[];
    return rows.map(rowToRun);
  }

  /**
   * Schedule (or re-schedule) all enabled jobs.
   * Call this on boot.
   */
  start(): void {
    for (const job of this.list()) {
      if (job.enabled) this.scheduleTask(job);
    }
  }

  stop(): void {
    for (const [id] of this.tasks) {
      this.unscheduleTask(id);
    }
  }

  /**
   * Run a job manually right now (skipping the scheduler). Useful for testing
   * and the `cron run :id` admin command.
   */
  async fireNow(jobId: string): Promise<{ success: boolean; result: string }> {
    const job = this.get(jobId);
    if (!job) return { success: false, result: 'job not found' };
    const fired = await this.fire(job, Date.now());
    return { success: fired.status === 'success', result: fired.result ?? fired.error ?? '' };
  }

  private scheduleTask(job: CronJob): void {
    this.unscheduleTask(job.id);
    if (!job.enabled) return;
    try {
      const task = cron.schedule(
        job.schedule,
        () => {
          void this.fire(job, Date.now());
        },
        { scheduled: true },
      );
      this.tasks.set(job.id, task);
    } catch (e) {
      console.error(`[cron] failed to schedule ${job.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  private unscheduleTask(id: string): void {
    const t = this.tasks.get(id);
    if (t) {
      try {
        t.stop();
      } catch {
        // ignore
      }
      this.tasks.delete(id);
    }
  }

  private async fire(job: CronJob, fireMs: number): Promise<CronRun> {
    const idempotencyKey = job.idempotencyKey ?? bucketKey(job.id, fireMs);
    const exists = this.db
      .prepare('SELECT id FROM cron_runs WHERE idempotency_key = ? LIMIT 1')
      .get(idempotencyKey) as { id: number } | undefined;
    if (exists) {
      return {
        id: exists.id,
        jobId: job.id,
        firedAt: fireMs,
        completedAt: fireMs,
        status: 'skipped',
        result: 'already fired',
        error: null,
        idempotencyKey,
      };
    }

    const insert = this.db
      .prepare(
        `INSERT INTO cron_runs (job_id, fired_at, status, idempotency_key)
         VALUES (?, ?, 'pending', ?)`,
      )
      .run(job.id, fireMs, idempotencyKey);
    const runId = Number(insert.lastInsertRowid);

    let status: CronRun['status'] = 'success';
    let result: string | null = null;
    let error: string | null = null;

    try {
      const session = this.sessions.ensureSession(
        job.sessionKey,
        job.channel,
        job.target,
        this.model,
      );
      const history = this.sessions.history(job.sessionKey);
      const runResult = await this.runner.run({
        session,
        systemPrompt: this.contextEngine.bootstrap().systemPrompt,
        history,
        userText: job.task,
      });
      this.sessions.appendAll(job.sessionKey, runResult.newHistory.slice(history.length));
      result = runResult.reply;
      if (this.delivery && job.channel && job.target && result) {
        try {
          await this.delivery(job.channel, job.target, result);
        } catch (e) {
          status = 'failed';
          error = `delivery failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : String(e);
    }

    const completedAt = Date.now();
    this.db
      .prepare(
        `UPDATE cron_runs SET completed_at = ?, status = ?, result = ?, error = ? WHERE id = ?`,
      )
      .run(completedAt, status, result, error, runId);
    this.db.prepare('UPDATE cron_jobs SET last_run_at = ? WHERE id = ?').run(completedAt, job.id);

    return {
      id: runId,
      jobId: job.id,
      firedAt: fireMs,
      completedAt,
      status,
      result,
      error,
      idempotencyKey,
    };
  }
}
