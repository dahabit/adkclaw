import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('google-auth-library');

import { verifyOidc, assertOidcConfig } from './verify-oidc.js';
import { OAuth2Client } from 'google-auth-library';

const snapshot = {
  audience: process.env.OIDC_AUDIENCE,
  sa: process.env.OIDC_SERVICE_ACCOUNT,
};

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

function getMockClient() {
  return (OAuth2Client as any).mock.results[0].value;
}

describe('verifyOidc', () => {
  beforeEach(() => {
    process.env.OIDC_AUDIENCE = 'https://my-service.run.app';
    process.env.OIDC_SERVICE_ACCOUNT = 'cloud-scheduler@example-project.iam.gserviceaccount.com';
  });

  afterEach(() => {
    process.env.OIDC_AUDIENCE = snapshot.audience;
    process.env.OIDC_SERVICE_ACCOUNT = snapshot.sa;
  });

  it('returns 500 when OIDC_AUDIENCE is unset', async () => {
    delete process.env.OIDC_AUDIENCE;
    const req = mkReq({ authorization: 'Bearer valid-token' });
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(500);
    expect(res._json).toEqual(
      expect.objectContaining({ error: expect.stringContaining('OIDC_AUDIENCE') }),
    );
  });

  it('returns 500 when OIDC_SERVICE_ACCOUNT is unset', async () => {
    delete process.env.OIDC_SERVICE_ACCOUNT;
    const req = mkReq({ authorization: 'Bearer valid-token' });
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(500);
    expect(res._json).toEqual(
      expect.objectContaining({ error: expect.stringContaining('OIDC_SERVICE_ACCOUNT') }),
    );
  });

  it('returns 401 when authorization header is missing', async () => {
    const req = mkReq({});
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'missing bearer token' });
  });

  it('returns 401 when authorization header does not start with Bearer', async () => {
    const req = mkReq({ authorization: 'Basic dXNlcjpwYXNz' });
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'missing bearer token' });
  });

  it('returns 401 when token verification throws', async () => {
    const mockClient = getMockClient();
    mockClient.verifyIdToken.mockRejectedValueOnce(new Error('Invalid signature'));

    const req = mkReq({ authorization: 'Bearer invalid-token' });
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'token verification failed' });
  });

  it('returns 401 when token payload is null', async () => {
    const mockClient = getMockClient();
    const mockTicket = {
      getPayload: vi.fn(() => null),
    };
    mockClient.verifyIdToken.mockResolvedValueOnce(mockTicket);

    const req = mkReq({ authorization: 'Bearer valid-token' });
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'service account not authorised' });
  });

  it('returns 401 when token email does not match service account', async () => {
    const mockClient = getMockClient();
    const mockTicket = {
      getPayload: vi.fn(() => ({
        email: 'wrong-account@example.iam.gserviceaccount.com',
      })),
    };
    mockClient.verifyIdToken.mockResolvedValueOnce(mockTicket);

    const req = mkReq({ authorization: 'Bearer valid-token' });
    const res = mkRes();
    await verifyOidc(req, res, () => {
      throw new Error('next should not be called');
    });
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'service account not authorised' });
  });

  it('calls next when token is valid, audience matches, and email matches', async () => {
    const mockClient = getMockClient();
    const mockTicket = {
      getPayload: vi.fn(() => ({
        email: 'cloud-scheduler@example-project.iam.gserviceaccount.com',
        aud: 'https://my-service.run.app',
      })),
    };
    mockClient.verifyIdToken.mockResolvedValueOnce(mockTicket);

    const req = mkReq({ authorization: 'Bearer valid-token' });
    const res = mkRes();
    let nextCalled = false;
    await verifyOidc(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeUndefined();
  });

  it('extracts token correctly from Bearer prefix', async () => {
    const mockClient = getMockClient();
    const mockTicket = {
      getPayload: vi.fn(() => ({
        email: 'cloud-scheduler@example-project.iam.gserviceaccount.com',
      })),
    };
    mockClient.verifyIdToken.mockResolvedValueOnce(mockTicket);

    const req = mkReq({ authorization: 'Bearer eyJhbGc...' });
    const res = mkRes();
    await verifyOidc(req, res, () => {});

    expect(mockClient.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'eyJhbGc...',
      audience: 'https://my-service.run.app',
    });
  });
});

describe('assertOidcConfig', () => {
  beforeEach(() => {
    process.env.OIDC_AUDIENCE = 'https://my-service.run.app';
    process.env.OIDC_SERVICE_ACCOUNT = 'cloud-scheduler@example-project.iam.gserviceaccount.com';
  });

  afterEach(() => {
    process.env.OIDC_AUDIENCE = snapshot.audience;
    process.env.OIDC_SERVICE_ACCOUNT = snapshot.sa;
  });

  it('throws when OIDC_AUDIENCE is unset', () => {
    delete process.env.OIDC_AUDIENCE;
    expect(() => assertOidcConfig()).toThrow(/OIDC_AUDIENCE is required/);
  });

  it('throws when OIDC_SERVICE_ACCOUNT is unset', () => {
    delete process.env.OIDC_SERVICE_ACCOUNT;
    expect(() => assertOidcConfig()).toThrow(/OIDC_SERVICE_ACCOUNT is required/);
  });

  it('does not throw when both env vars are set', () => {
    expect(() => assertOidcConfig()).not.toThrow();
  });
});
