import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { adminAuth, assertAdminKey } from './admin-auth.js';

const SNAPSHOT = process.env.ADMIN_KEY;

function mkReq(headers: Record<string, string>): Request {
  return { header: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
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

describe('adminAuth', () => {
  beforeEach(() => {
    process.env.ADMIN_KEY = 'expected-key';
  });

  afterAll(() => {
    process.env.ADMIN_KEY = SNAPSHOT;
  });

  it('passes when x-admin-key matches', () => {
    const req = mkReq({ 'x-admin-key': 'expected-key' });
    const res = mkRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };
    adminAuth(req, res, next);
    expect(called).toBe(true);
    expect(res._status).toBeUndefined();
  });

  it('returns 401 when x-admin-key is missing', () => {
    const req = mkReq({});
    const res = mkRes();
    adminAuth(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
  });

  it('returns 401 when x-admin-key is wrong', () => {
    const req = mkReq({ 'x-admin-key': 'guess' });
    const res = mkRes();
    adminAuth(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
  });

  it('returns 500 when ADMIN_KEY env is unset', () => {
    delete process.env.ADMIN_KEY;
    const req = mkReq({ 'x-admin-key': 'anything' });
    const res = mkRes();
    adminAuth(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(500);
  });
});

describe('assertAdminKey', () => {
  it('throws when ADMIN_KEY is unset', () => {
    delete process.env.ADMIN_KEY;
    expect(() => assertAdminKey()).toThrow(/ADMIN_KEY is required/);
  });

  it('returns silently when ADMIN_KEY is set', () => {
    process.env.ADMIN_KEY = 'x';
    expect(() => assertAdminKey()).not.toThrow();
  });
});
