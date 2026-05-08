import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';
import { makeCronFireHandler } from './cron-fire.js';

function mkReq(body: unknown): Request {
  return { body } as Request;
}

function mkRes(): Response & { _status?: number; _json?: unknown } {
  const r: Response & { _status?: number; _json?: unknown } = {
    status(s: number) {
      r._status = s;
      return r;
    },
    json(o: unknown) {
      r._json = o;
      return r;
    },
  } as unknown as Response & { _status?: number; _json?: unknown };
  return r;
}

describe('cronFireHandler', () => {
  it('returns 400 on missing jobId', async () => {
    const handler = makeCronFireHandler(async () => 'ran');
    const res = mkRes();
    await handler(mkReq({}), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 on unknown jobId', async () => {
    const handler = makeCronFireHandler(async () => 'ran');
    const res = mkRes();
    await handler(mkReq({ jobId: 'rm-rf-prod' }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 + result on allowlisted jobId', async () => {
    const handler = makeCronFireHandler(async (id: string) => `ran ${id}`);
    const res = mkRes();
    await handler(mkReq({ jobId: 'heartbeat' }), res);
    expect(res._status).toBeUndefined();
    expect(res._json).toEqual({ ok: true, jobId: 'heartbeat', result: 'ran heartbeat' });
  });

  it('returns 500 when runner throws', async () => {
    const handler = makeCronFireHandler(async () => {
      throw new Error('boom');
    });
    const res = mkRes();
    await handler(mkReq({ jobId: 'heartbeat' }), res);
    expect(res._status).toBe(500);
  });
});
