import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * verifyOidc — Express middleware that verifies a Google OIDC token in the
 * Authorization header. Used to protect routes that only Cloud Scheduler
 * (or another Google-authenticated caller) should reach — primarily
 * `/api/cron/fire`.
 *
 * Required env (validated at startup via assertOidcConfig):
 *   OIDC_AUDIENCE        — Cloud Run service URL the token was scoped to
 *   OIDC_SERVICE_ACCOUNT — service account email allowed to invoke
 *
 * Three checks:
 *   1. Token signature against Google's public keys
 *   2. Audience matches OIDC_AUDIENCE
 *   3. Token's `email` claim matches OIDC_SERVICE_ACCOUNT
 *
 * Any failure → 401.
 */
export async function verifyOidc(req: Request, res: Response, next: NextFunction): Promise<void> {
  const audience = process.env.OIDC_AUDIENCE;
  const allowedSa = process.env.OIDC_SERVICE_ACCOUNT;
  if (!audience || !allowedSa) {
    res
      .status(500)
      .json({ error: 'server misconfigured: OIDC_AUDIENCE or OIDC_SERVICE_ACCOUNT unset' });
    return;
  }

  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  const token = auth.slice('Bearer '.length);

  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload || payload.email !== allowedSa) {
      res.status(401).json({ error: 'service account not authorised' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'token verification failed' });
  }
}

export function assertOidcConfig(): void {
  if (!process.env.OIDC_AUDIENCE) {
    throw new Error('OIDC_AUDIENCE is required (set to your Cloud Run service URL).');
  }
  if (!process.env.OIDC_SERVICE_ACCOUNT) {
    throw new Error(
      'OIDC_SERVICE_ACCOUNT is required (the email of the Cloud Scheduler service account).',
    );
  }
}
