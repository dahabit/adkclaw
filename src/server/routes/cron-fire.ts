import type { Request, Response } from 'express';

export type CronJobRunner = (jobId: string) => Promise<unknown>;

/** Whitelist of job IDs we accept. Anything else → 400. */
const ALLOWED_JOB_IDS = new Set(['daily-summary', 'weekly-digest', 'heartbeat']);

/**
 * cronFireHandler — receives Cloud Scheduler invocations after `verifyOidc`.
 *
 * Body: `{ "jobId": "..." }`. The jobId must be in ALLOWED_JOB_IDS to prevent
 * the OIDC-authenticated caller from invoking arbitrary tasks.
 *
 * Returns 200 with the job result, 400 on unknown jobId, 500 on runner error.
 */
export function makeCronFireHandler(runner: CronJobRunner) {
  return async function (req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as { jobId?: unknown };
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!ALLOWED_JOB_IDS.has(jobId)) {
      res.status(400).json({
        error: `unknown jobId; allowed: ${[...ALLOWED_JOB_IDS].join(', ')}`,
      });
      return;
    }
    try {
      const result = await runner(jobId);
      res.json({ ok: true, jobId, result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'job failed' });
    }
  };
}
