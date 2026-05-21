import type { Request, Response, NextFunction } from 'express';

/**
 * adminAuth — Express middleware that rejects requests without a valid
 * `x-admin-key` header. Used on the dashboard and `/api/admin/*`.
 *
 * The daemon FATALs at startup if `ADMIN_KEY` is unset (see assertAdminKey).
 * This middleware therefore assumes the env is already validated.
 *
 * Why a header (not a cookie / JWT)?
 *   - Admin key is a single-operator credential; sessions add complexity.
 *   - Header is curl-friendly and pairs naturally with Secret Manager.
 *
 * Telegram and `/api/cron/fire` have their own auth (webhook secret + OIDC)
 * and MUST NOT be wrapped by this middleware.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    res.status(500).json({ error: 'server misconfigured: ADMIN_KEY unset' });
    return;
  }
  const supplied = req.header('x-admin-key');
  if (!supplied || !timingSafeEqual(supplied, expected)) {
    res.status(401).json({ error: 'unauthorised' });
    return;
  }
  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Call this once at startup. Throws if ADMIN_KEY is unset.
 */
export function assertAdminKey(): void {
  if (!process.env.ADMIN_KEY) {
    throw new Error(
      'ADMIN_KEY is required. Generate: openssl rand -hex 32 | gcloud secrets create admin-key --data-file=-',
    );
  }
}
