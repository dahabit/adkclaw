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
  //REPLACE-VERIFY-OIDC
  // Verify a Google-signed OIDC Bearer token against OIDC_AUDIENCE and
  // OIDC_SERVICE_ACCOUNT. Fail-closed: any error → 401, never call next().
  // From level_5/codelab.md §9 "Schedule cron via Cloud Scheduler".
  void req;
  void next;
  res.status(501).json({ error: 'REPLACE-VERIFY-OIDC not implemented — see level_5/codelab.md §9' });
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
