author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert, MENA Dev community)
summary: Take your deployed AdkClaw agent from "shipped" to production-grade. Implement nine security gates and make the daemon refuse to start when any of them is missing.
id: adkclaw-codelab-5-harden
categories: ai,ml,gemini,adk,typescript,security,cloud-run
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 5 — Harden the Cloud: From Shipped to Production-Grade

## Before you begin

You finished Level 4. Your agent is on Cloud Run, reachable from Telegram, persisting in Firestore. It works. But "works" and "production-grade" are different categories — and the gap is what gets you a $400 bill at 3 a.m. or a leaked session log on Twitter.

This codelab closes nine specific gaps. By the end, the daemon **refuses to start** without each gate wired and configured. That's structural enforcement, not policy hope.

> **Verified reference.** The Level 5 starter is tagged `v5-complete`.
> `git checkout v5-complete -- codelab/starter/` gives this level's end state
> (`npm run build` + `npm run typecheck` clean, 127 tests passing);
> `git diff v4-complete v5-complete -- codelab/starter/` is the implementation
> diff. The DLP and Firestore-rules paths need GCP or the emulator for full
> runtime verification.

### Prerequisites

- Completed [Level 4 — Ship to the Cloud](../level_4/codelab.md)
- A live Cloud Run service URL with Telegram + Firestore working
- `gcloud` CLI authenticated, project + region exported
- 150 minutes of focused time (this is the longest level — security work doesn't accelerate)

### What you'll learn

- Threat-model your own agent before you defend it
- Add admin auth to internal routes (the dashboard is not public)
- Implement OIDC verification on `/api/cron/fire` so only Cloud Scheduler can call it
- Make `BudgetGuard` FATAL on missing config — kill the silent default
- Replace your regex PII redactor with Cloud DLP
- Write default-deny Firestore security rules + verify against the emulator
- Run a secret-rotation drill end-to-end with zero downtime
- Harden the supply chain (`npm audit`, container scan, lockfile discipline)
- Wire Cloud Monitoring alerts for token + cost spikes

### What you'll build

- A `THREAT_MODEL.md` with 12 threats mapped to controls
- Six new src files implementing the gates
- A passing test suite that fails when a gate is missing
- A redeployed Cloud Run service that returns 401 to every public probe of an internal route

## 1. Threat-model your agent (15 min)

Security work without a threat model is shadow boxing. Before any code, write down what can go wrong.

```bash
cp level_5/THREAT_MODEL.template.md THREAT_MODEL.md
```

The template has 12 starter rows. For each, you'll fill in: **status** (DEFENDED / MITIGATED / ACCEPTED / OPEN) and the **specific control** that covers it.

Sample rows:

| # | Threat | Likelihood | Impact | Control | Status |
|---|---|---|---|---|---|
| 1 | Gemini API key leaks via committed `.env` | High | High | `.gitignore` + pre-commit hook | DEFENDED |
| 2 | Anyone POSTs to `/api/cron/fire` and runs your jobs | Medium | High | OIDC verification middleware | (you implement in §3) |
| 3 | Buggy spawn loop runs up $400 in Gemini calls | Medium | High | `BudgetGuard` FATAL on startup | (you implement in §4) |
| 4 | Telegram bot token leaks via bash history | Low | High | `gcloud secrets create --data-file=/dev/stdin` | DEFENDED |
| 5 | PII (emails, phones) lands in Cloud Logging | Medium | Medium | Cloud DLP redactor in logger | (you implement in §5) |
| 6 | Anyone reads Firestore via the public client | Low | High | Default-deny rules + service-account auth | (you implement in §6) |
| 7 | Stale Telegram webhook secret remains valid forever | Low | Medium | 90-day rotation runbook | (you implement in §7) |
| 8 | Compromised npm dep ships in your container | Low | Critical | `npm audit --production` + lockfile + container scan | (you implement in §8) |
| 9 | Cron job fires every minute due to bug, drains budget | Low | High | `BudgetGuard` + Cloud Monitoring alert | (you implement in §4 + §9) |
| 10 | Sub-agent spawn loop bypasses tool allowlist | Low | High | L3 isolation rules + this codelab's `audit` test | DEFENDED + verified in §9 |
| 11 | Admin dashboard at `/` exposes session keys to the public internet | High | High | Admin-key middleware on all internal routes | (you implement in §2) |
| 12 | Service account is over-privileged (Editor role) | High | Critical | Least-privilege rebind to four specific roles | (you verify in §6) |

Commit `THREAT_MODEL.md` now. Update each row's **Status** as you complete the corresponding section. By the end of this codelab, every row should be DEFENDED, MITIGATED, or explicitly ACCEPTED with rationale.

### Section recap

The threat model is your contract with future-you. Six months from now you (or a co-instructor) will revisit this document. If a new gap appears, it gets a row, a control, and a deadline. If a gap is acceptable, it gets a written reason. Nothing stays implicit.

## 2. Admin auth on `/` — the dashboard is not public (20 min)

Cloud Run with `--allow-unauthenticated` means **anyone with the URL can hit any route**. Telegram and `/api/cron/fire` have their own auth (webhook secret + OIDC). The dashboard at `/` and the admin routes do not. Time to fix that.

### Generate the admin key

```bash
ADMIN_KEY=$(openssl rand -hex 32)
echo -n "$ADMIN_KEY" | gcloud secrets create admin-key --data-file=- --project=$PROJECT
echo "$ADMIN_KEY"
# Copy the value — store it in your password manager. You won't see it again from gcloud.
```

> **Don't `echo "$ADMIN_KEY"` in your normal shell.** Bash history. Pipe directly to `gcloud secrets create --data-file=-` and clear `$ADMIN_KEY` immediately after with `unset ADMIN_KEY`.

### Implement the middleware

Create `src/server/middleware/admin-auth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';

/**
 * adminAuth — express middleware that rejects requests without a valid x-admin-key header.
 *
 * Wired on `/` (dashboard) and `/api/admin/*`. Telegram and /api/cron/fire have their own
 * auth (webhook secret + OIDC) and are NOT protected by this middleware.
 *
 * On startup the daemon FATALS if process.env.ADMIN_KEY is unset — this is structural,
 * not advisory. See src/agent/budget.ts for the same pattern on DAILY_TOKEN_BUDGET.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    // Should never happen — main.ts FATALS at startup if ADMIN_KEY is unset.
    res.status(500).json({ error: 'server misconfigured: ADMIN_KEY unset' });
    return;
  }
  const supplied = req.header('x-admin-key');
  if (!supplied || supplied !== expected) {
    res.status(401).json({ error: 'unauthorised' });
    return;
  }
  next();
}
```

### Make it FATAL at startup

In your daemon entry point (`src/index.ts` or `src/main.ts`), before mounting routes:

```typescript
function fatal(reason: string): never {
  console.error(`FATAL: ${reason}`);
  process.exit(1);
}

if (!process.env.ADMIN_KEY) {
  fatal('ADMIN_KEY is required. Generate: openssl rand -hex 32 | gcloud secrets create admin-key --data-file=-');
}
```

Wire the middleware on the dashboard + admin routes:

```typescript
import { adminAuth } from './server/middleware/admin-auth.js';

app.get('/', adminAuth, dashboardHandler);
app.use('/api/admin', adminAuth);
```

### Update your Cloud Run deploy

```bash
gcloud run services update $SERVICE \
  --region=$REGION \
  --update-secrets="ADMIN_KEY=admin-key:latest"
```

### Test it

```bash
# Anonymous — should 401
curl -i $SERVICE_URL/

# With the key — should 200
curl -H "x-admin-key: $(gcloud secrets versions access latest --secret=admin-key)" $SERVICE_URL/
```

Update THREAT_MODEL row 11 → DEFENDED.

### Section recap

Admin auth is a single header check, but it's the difference between "internal state visible to the public internet" and "internal state requires possession of a 32-byte secret." That's not a small difference. The FATAL on startup is the part most teams skip — and it's the part that ensures a future you, debugging a deploy at 2 a.m., can never accidentally ship without the gate wired.

## 3. OIDC on `/api/cron/fire` — only Cloud Scheduler may call (20 min)

The L4 codelab teaches Cloud Scheduler. The codelab also says "wire OIDC verification" but doesn't make it mandatory. We fix that here.

### What OIDC actually does

Cloud Scheduler signs a JWT with Google's OIDC identity provider, scoped to a service account email and an audience (your Cloud Run service URL). On the receiving side, you verify:

1. The token's signature against Google's public keys
2. The audience matches your service URL
3. The service account email matches the one your scheduler job is configured with

Three checks. If any fails, 401.

### Implement the verifier

Install the Google Auth library:

```bash
npm install google-auth-library
```

Create `src/server/middleware/verify-oidc.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * verifyOidc — express middleware that verifies a Google OIDC token in the Authorization header.
 *
 * Required env:
 *   OIDC_AUDIENCE        — Cloud Run service URL the token was scoped to
 *   OIDC_SERVICE_ACCOUNT — service account email allowed to invoke (Cloud Scheduler's SA)
 *
 * On startup the daemon FATALS if either env is unset.
 */
export async function verifyOidc(req: Request, res: Response, next: NextFunction): Promise<void> {
  const audience = process.env.OIDC_AUDIENCE;
  const allowedSa = process.env.OIDC_SERVICE_ACCOUNT;
  if (!audience || !allowedSa) {
    res.status(500).json({ error: 'server misconfigured: OIDC_AUDIENCE or OIDC_SERVICE_ACCOUNT unset' });
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
  } catch (err) {
    res.status(401).json({ error: 'token verification failed' });
  }
}
```

### Implement the route

Create `src/server/routes/cron-fire.ts`:

```typescript
import type { Request, Response } from 'express';
import { runJobOnce } from '../../cron/engine.js';

const ALLOWED_JOB_IDS = new Set(['daily-summary', 'weekly-digest', 'heartbeat']);

export async function cronFireHandler(req: Request, res: Response): Promise<void> {
  const { jobId } = req.body ?? {};
  if (typeof jobId !== 'string' || !ALLOWED_JOB_IDS.has(jobId)) {
    res.status(400).json({ error: `unknown jobId; allowed: ${[...ALLOWED_JOB_IDS].join(', ')}` });
    return;
  }
  try {
    const result = await runJobOnce(jobId);
    res.json({ ok: true, jobId, result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'job failed' });
  }
}
```

### Wire it

In `src/server/index.ts` (or wherever your routes mount):

```typescript
import { verifyOidc } from './middleware/verify-oidc.js';
import { cronFireHandler } from './routes/cron-fire.js';

app.post('/api/cron/fire', verifyOidc, cronFireHandler);
```

### FATAL at startup

Add to the startup checks:

```typescript
if (!process.env.OIDC_AUDIENCE) fatal('OIDC_AUDIENCE is required');
if (!process.env.OIDC_SERVICE_ACCOUNT) fatal('OIDC_SERVICE_ACCOUNT is required');
```

### Configure Cloud Scheduler

```bash
SA_EMAIL="adkclaw-scheduler@$PROJECT.iam.gserviceaccount.com"

# Create the service account if it doesn't exist
gcloud iam service-accounts create adkclaw-scheduler \
  --display-name="AdkClaw Cloud Scheduler invoker"

# Grant it run.invoker on your service
gcloud run services add-iam-policy-binding $SERVICE \
  --region=$REGION \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.invoker"

# Create or update the scheduler job
gcloud scheduler jobs create http adkclaw-heartbeat \
  --location=$REGION \
  --schedule="*/30 * * * *" \
  --uri="$SERVICE_URL/api/cron/fire" \
  --http-method=POST \
  --message-body='{"jobId":"heartbeat"}' \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email=$SA_EMAIL \
  --oidc-token-audience=$SERVICE_URL
```

Update Cloud Run env:

```bash
gcloud run services update $SERVICE \
  --region=$REGION \
  --update-env-vars="OIDC_AUDIENCE=$SERVICE_URL,OIDC_SERVICE_ACCOUNT=$SA_EMAIL"
```

### Test it

```bash
# Anonymous — should 401
curl -i -X POST $SERVICE_URL/api/cron/fire -H "Content-Type: application/json" -d '{"jobId":"heartbeat"}'

# Trigger via scheduler — should 200
gcloud scheduler jobs run adkclaw-heartbeat --location=$REGION
gcloud logging read "resource.type=cloud_run_revision AND textPayload=~heartbeat" --limit=5
```

Update THREAT_MODEL row 2 → DEFENDED.

### Section recap

The 401 from the anonymous curl is the entire point of this section. If your endpoint returns 200 to anyone with the URL, your scheduler is the public internet. OIDC is two short files — middleware + route — but until both are wired and FATAL at startup, the gate is policy hope, not enforcement.

## 4. BudgetGuard FATAL — kill the silent default (15 min)

The L1 codelab introduced `BudgetGuard`. The L4 codelab said "keep it wired." Neither made it mandatory at startup. Your `BudgetGuard` currently defaults to `500_000` tokens/day if `DAILY_TOKEN_BUDGET` is unset — a silent 500k budget is exactly the kind of "configuration by accident" that produces the $400 bill.

### Make it explicit

Edit `src/agent/budget.ts`:

```typescript
// BEFORE (problematic):
const DEFAULT_DAILY_BUDGET = 500_000;

// AFTER (this section):
function loadDailyBudget(): number {
  const raw = process.env.DAILY_TOKEN_BUDGET;
  if (!raw) {
    throw new Error('DAILY_TOKEN_BUDGET is required. Set it explicitly — there is no safe default.');
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) {
    throw new Error(`DAILY_TOKEN_BUDGET must be a number >= 1000, got: ${raw}`);
  }
  return n;
}
```

The constructor should call `loadDailyBudget()` at instantiation. If the daemon imports `BudgetGuard` at startup and the env is unset, the daemon dies before serving a single request. That's the contract.

### Add the FATAL gate at startup

```typescript
// In src/index.ts, before instantiating BudgetGuard
if (!process.env.DAILY_TOKEN_BUDGET) {
  fatal('DAILY_TOKEN_BUDGET is required (recommended: 100000 for a single user, 500000 for a team).');
}
```

### Wire a Cloud Billing alert

```bash
# Reusable: token spend manifests as Vertex AI / Gemini API costs.
# Set a Cloud Billing budget at 1.5× your DAILY_TOKEN_BUDGET-equivalent dollar value,
# email yourself when spending crosses 50% / 90% / 100%.

gcloud billing budgets create \
  --billing-account=$BILLING_ACCOUNT \
  --display-name="adkclaw-daily-spend" \
  --budget-amount=10USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --filter-projects=projects/$PROJECT
```

### Test the FATAL

```bash
# Locally
unset DAILY_TOKEN_BUDGET
npm run start
# Expect: FATAL: DAILY_TOKEN_BUDGET is required ... Process exits with code 1.

DAILY_TOKEN_BUDGET=200000 npm run start
# Expect: daemon starts cleanly.
```

Update THREAT_MODEL rows 3 and 9 → DEFENDED.

### Section recap

The pattern here — read env, validate, throw at startup — is the reusable template for every other gate. Configuration is part of the program; missing config is a bug, not a runtime quirk to handle gracefully.

## 5. Cloud DLP for PII redaction (25 min)

Your L4 logger has a regex redactor. Regex is acceptable for a known-shape input (an email pattern). It's bad for unstructured prose ("Sara at HR at 42 Oak St"). Cloud DLP is Google's actual classifier — it knows names, addresses, government IDs, payment cards, and 100+ other infoTypes.

### Enable + permission

```bash
gcloud services enable dlp.googleapis.com
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/dlp.user"
```

### Implement the redactor

```bash
npm install @google-cloud/dlp
```

Create `src/lib/dlp.ts`:

```typescript
import DLP from '@google-cloud/dlp';

const dlpClient = new DLP.DlpServiceClient();
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? '';

const INFO_TYPES = [
  { name: 'EMAIL_ADDRESS' },
  { name: 'PHONE_NUMBER' },
  { name: 'STREET_ADDRESS' },
  { name: 'PERSON_NAME' },
  { name: 'CREDIT_CARD_NUMBER' },
  { name: 'IP_ADDRESS' },
  { name: 'US_SOCIAL_SECURITY_NUMBER' },
  { name: 'IBAN_CODE' },
];

export async function redactPii(text: string): Promise<string> {
  if (!PROJECT) return text;
  const [response] = await dlpClient.deidentifyContent({
    parent: `projects/${PROJECT}/locations/global`,
    deidentifyConfig: {
      infoTypeTransformations: {
        transformations: [
          {
            primitiveTransformation: {
              replaceWithInfoTypeConfig: {},
            },
          },
        ],
      },
    },
    inspectConfig: { infoTypes: INFO_TYPES, minLikelihood: 'POSSIBLE' },
    item: { value: text },
  });
  return response.item?.value ?? text;
}
```

### Wire it into the logger

In `src/lib/logger.ts`:

```typescript
import { redactPii } from './dlp.js';

const REDACT = process.env.LOG_REDACT === 'true';

export async function logInfo(message: string, fields: Record<string, unknown> = {}): Promise<void> {
  const safe = REDACT ? await redactPii(message) : message;
  console.log(JSON.stringify({ severity: 'INFO', message: safe, ...fields }));
}
```

Set `LOG_REDACT=true` in Cloud Run; leave it false for local dev (DLP costs per call).

### Test it

```typescript
// src/lib/dlp.test.ts
import { describe, it, expect } from 'vitest';
import { redactPii } from './dlp.js';

describe('redactPii', () => {
  it('redacts emails', async () => {
    const out = await redactPii('Reach me at name@example.com');
    expect(out).not.toContain('name@example.com');
    expect(out).toContain('[EMAIL_ADDRESS]');
  });

  it('redacts phone numbers', async () => {
    const out = await redactPii('Call +1-555-867-5309');
    expect(out).not.toContain('555-867-5309');
  });

  it('returns input unchanged when project is missing', async () => {
    const orig = process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    const out = await redactPii('email: x@y.com');
    expect(out).toBe('email: x@y.com');
    process.env.GOOGLE_CLOUD_PROJECT = orig;
  });
});
```

Update THREAT_MODEL row 5 → DEFENDED.

### Section recap

DLP is one API call but it's the difference between "I redact emails I thought of" and "I redact PII Google's classifier knows about." The cost (~$1 per 1k calls) is offset by enabling it only on the production logger, not on every dev run.

## 6. Firestore default-deny rules + emulator tests (15 min)

L4 created a Firestore database. By default, `--allow-unauthenticated` Cloud Run services use the **runtime service account** to access Firestore. That works because the SA has `roles/datastore.user` — but it also means *anyone* with a stolen Cloud Run URL who can spoof the runtime SA can read all sessions.

Default-deny rules close that.

### Write the rules

Create `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Default: deny all access.
    match /{document=**} {
      allow read, write: if false;
    }

    // Sessions are written exclusively by the runtime service account.
    // No client-side rule allows access — the SDK on Cloud Run uses
    // the runtime SA's IAM, which bypasses these rules.
    // The match block is here as defense-in-depth: if someone disables
    // SA-based bypass, no client gets in.
    match /sessions/{sessionKey} {
      allow read, write: if false;
    }

    match /messages/{messageId} {
      allow read, write: if false;
    }

    match /cron_runs/{runId} {
      allow read, write: if false;
    }
  }
}
```

### Deploy the rules

```bash
gcloud firestore rules import firestore.rules
```

### Verify with the emulator

```bash
# Terminal 1
gcloud emulators firestore start --host-port=localhost:8080

# Terminal 2
export FIRESTORE_EMULATOR_HOST=localhost:8080
npm test src/storage/firestore-rules.test.ts
```

A starter test (in `src/storage/firestore-rules.test.ts`):

```typescript
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-adkclaw',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore rules', () => {
  it('denies anonymous reads on sessions', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await expect(anon.collection('sessions').doc('any').get()).rejects.toThrow();
  });

  it('denies anonymous writes on messages', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await expect(anon.collection('messages').doc('any').set({})).rejects.toThrow();
  });
});
```

### Verify least privilege on the runtime SA

```bash
# List all roles bound to your runtime SA
gcloud projects get-iam-policy $PROJECT \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$RUNTIME_SA"

# Required: roles/datastore.user, roles/secretmanager.secretAccessor, roles/dlp.user, roles/logging.logWriter.
# Anything else (especially Editor or Owner) is over-privileged. Remove with:
gcloud projects remove-iam-policy-binding $PROJECT \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/editor"
```

Update THREAT_MODEL rows 6 and 12 → DEFENDED.

### Section recap

Default-deny is policy as code. The IAM-bypass-via-SA is the part that surprises most teams: server-side SDKs *don't* enforce client-side rules by default, because they're trusted. The rules are defense-in-depth: if someone lifts your SA key (or someone enables direct client SDK access later), the default-deny still holds.

## 7. Secret-rotation drill (15 min)

Generate a leak. Run the playbook. Verify nothing breaks.

### Create the runbook

Add `RUNBOOK.md` to your repo:

```markdown
# AdkClaw — Secret Rotation Runbook

## When to use
- Suspected leak (committed by mistake, screenshot, log exposure)
- Routine 90-day rotation
- Co-instructor offboarding

## Gemini API key
1. Generate new: visit https://aistudio.google.com/apikey, create new key
2. Store: `echo -n NEWKEY | gcloud secrets versions add gemini-api-key --data-file=-`
3. Refresh service: `gcloud run services update $SERVICE --region=$REGION --update-secrets=GEMINI_API_KEY=gemini-api-key:latest`
4. Verify: send a test message via Telegram; check Cloud Run logs show no 401 errors.
5. Revoke old: in AI Studio, delete the previous key.

## Telegram bot token
1. `@BotFather` → `/revoke` → get new token
2. `echo -n NEWTOKEN | gcloud secrets versions add telegram-bot-token --data-file=-`
3. `gcloud run services update $SERVICE --region=$REGION --update-secrets=TELEGRAM_BOT_TOKEN=telegram-bot-token:latest`
4. Re-register webhook: `curl https://api.telegram.org/bot$NEWTOKEN/setWebhook?url=$SERVICE_URL/webhook&secret_token=$WEBHOOK_SECRET`
5. Verify: send a test message to the bot.

## Webhook secret
1. Generate: `WEBHOOK_SECRET=$(openssl rand -hex 32)`
2. `echo -n $WEBHOOK_SECRET | gcloud secrets versions add telegram-webhook-secret --data-file=-`
3. Refresh service: `gcloud run services update ... --update-secrets=TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret:latest`
4. Re-register webhook with new secret (see above).
5. `unset WEBHOOK_SECRET`.

## Admin key (the dashboard key from §2)
Same pattern: generate, secrets versions add, services update, verify with `curl -H "x-admin-key: ..."`.
```

### Run the drill

Pick the Gemini key. Rotate it. Time how long the daemon is broken. Target: < 60 seconds (Cloud Run picks up the new secret on next request).

```bash
START=$(date +%s)
NEW=$(curl -s -X POST https://aistudio.google.com/... # generate new key out-of-band
echo -n "$NEW" | gcloud secrets versions add gemini-api-key --data-file=-
gcloud run services update $SERVICE --region=$REGION --update-secrets="GEMINI_API_KEY=gemini-api-key:latest"
# Send a test message via Telegram, watch for 200 in logs
END=$(date +%s)
echo "Rotation took $((END - START))s"

# Verify old key is now 401:
curl -i -H "x-goog-api-key: $OLD_KEY" https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent
# Expect 401 / 403
```

Update THREAT_MODEL row 7 → DEFENDED.

### Section recap

Rotation only matters if you've practiced it. The first time you rotate under pressure, you'll find an unwritten step. The second time you'll find another. The runbook captures them so the third time is uneventful.

## 8. Supply-chain hardening (15 min)

Your container ships ~150 npm dependencies, transitively. Each is a potential supply-chain attack surface.

### npm audit in CI

In `.github/workflows/security.yml`:

```yaml
name: security
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm audit --production --audit-level=high
```

`npm ci` (not `npm install`) refuses to run if `package-lock.json` doesn't match. That's the lockfile discipline.

### Container scan via Artifact Registry

```bash
# Enable container analysis
gcloud services enable containerscanning.googleapis.com

# When you push the image, AR auto-scans
gcloud artifacts repositories create adkclaw-images \
  --repository-format=docker \
  --location=$REGION

# After cloudbuild pushes the image:
gcloud artifacts docker images describe \
  $REGION-docker.pkg.dev/$PROJECT/adkclaw-images/adkclaw:latest \
  --show-package-vulnerability
```

Document any HIGH or CRITICAL vulnerabilities in `THREAT_MODEL.md` row 8 with status ACCEPTED + reason or DEFENDED + commit-link.

### Pin transitive deps with overrides

If `npm audit` flags a vulnerable transitive dep your direct dep doesn't pin:

```json
{
  "overrides": {
    "vulnerable-package": "1.2.3"
  }
}
```

Test thoroughly — overrides can break.

Update THREAT_MODEL row 8 → DEFENDED.

### Section recap

Supply-chain attacks are cheap to ignore and devastating when they hit. The CI step is two YAML lines and the lockfile discipline is one CLI flag. There's no excuse to skip it.

## 9. Audit + anomaly alerts (10 min)

Detection closes the loop. The previous gates prevent known threats; alerts tell you when something unexpected slipped through.

### Token-spike alert

```bash
gcloud monitoring policies create \
  --notification-channels=$EMAIL_CHANNEL \
  --display-name="AdkClaw — Gemini token spike" \
  --condition-display-name="Tokens > 2x daily average" \
  --condition-filter='metric.type="generativelanguage.googleapis.com/token_count" AND resource.type="generativelanguage.googleapis.com/Endpoint"' \
  --condition-threshold-value=2.0 \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-aggregation-perSeriesAligner=ALIGN_DELTA \
  --condition-aggregation-alignmentPeriod=3600s
```

(The exact gcloud invocation is verbose; consult the latest Cloud Monitoring docs for the current syntax. The point is: an alert fires when 1-hour token spend exceeds 2× the trailing 24-hour average.)

### Cost-spike alert (Cloud Billing)

You set this up in §4 — the budget alert at 50% / 90% / 100%. Confirm it's still active:

```bash
gcloud billing budgets list --billing-account=$BILLING_ACCOUNT --filter="displayName:adkclaw-daily-spend"
```

### Audit-log query

A saved query in Cloud Logging that surfaces every `/api/cron/fire` 401 in the last 24h:

```
resource.type="cloud_run_revision"
httpRequest.status=401
httpRequest.requestUrl=~"/api/cron/fire"
timestamp>="-24h"
```

Pin this query in Logs Explorer. If you see 401s from unfamiliar IPs, you've got someone trying to invoke your cron. The 401 means OIDC held — but you should still know.

Update THREAT_MODEL row 9 → DEFENDED.

### Section recap

Alerts you don't react to are noise. Configure email + sms (or Telegram bot — your agent could be the alert channel!) and triage what fires. Every alert that fires twice without action gets retuned or removed.

## 10. Run the verifier

The codelab ships a security verifier:

```bash
npm run audit:security
```

This script checks:

- All six required env vars are set (`ADMIN_KEY`, `DAILY_TOKEN_BUDGET`, `ALLOWED_SENDERS`, `TELEGRAM_WEBHOOK_SECRET`, `OIDC_AUDIENCE`, `OIDC_SERVICE_ACCOUNT`)
- All four required gates respond as expected (`GET /` returns 401, `POST /api/cron/fire` returns 401, daemon FATALS without `DAILY_TOKEN_BUDGET`, `redactPii` returns redacted output)
- `firestore.rules` denies anonymous access
- `npm audit --production` returns 0 critical/high

If any check fails, you're not production-ready yet.

### Final exit criteria

- [ ] `THREAT_MODEL.md` committed with all 12 rows resolved (DEFENDED, MITIGATED, or ACCEPTED with rationale)
- [ ] Anonymous `curl $SERVICE_URL/` returns 401
- [ ] Anonymous `curl -X POST $SERVICE_URL/api/cron/fire` returns 401
- [ ] Daemon FATALS without any of `ADMIN_KEY`, `DAILY_TOKEN_BUDGET`, `ALLOWED_SENDERS`, `TELEGRAM_WEBHOOK_SECRET`, `OIDC_AUDIENCE`, `OIDC_SERVICE_ACCOUNT`
- [ ] `redactPii('Email me at x@y.com')` returns text without the email
- [ ] `firestore-rules.test.ts` passes against the emulator
- [ ] Secret-rotation drill completed for at least Gemini key (timed, < 60s downtime)
- [ ] `npm audit --production` returns 0 high/critical (or documented in THREAT_MODEL row 8)
- [ ] Token-spike alert configured + verified by triggering a test alert

## 11. Light up your Hardened badge (the fifth pillar)

When the verifier passes and `THREAT_MODEL.md` is committed, your agent calls `mark_level_complete` with `level: 5`, `region`, and the verifier output. The platform issues the **🛡️ Hardened pillar badge** — the fifth and final on `adkclaw.dev/u/<your-username>`.

You're not just shipped. You're shipped *responsibly*.

## What you have now

A chatbot answers. An agent acts. A **hardened agent** acts and refuses to act badly. You walked in with a deployed L4 service and walked out with:

- A threat model you'll keep updating
- Six new src files implementing concrete gates
- A verifier that fails CI before bad code lands
- A secret-rotation muscle memory
- Detection wired into Cloud Monitoring

The patterns scale. Add a Slack channel? It needs the same auth gates. Add a RAG corpus? Firestore rules cover it. Add a voice channel? OIDC-protected webhook still applies.

## What's next

You finished the canonical journey. From here:

- **Run a hardening drill quarterly** — pick a row from `THREAT_MODEL.md`, simulate the threat, verify the control fires
- **Stretch tracks** in `extensions/`: Slack, RAG over private docs, voice (Gemini Live), MCP server
- **Contribute back** — open an issue when you find a gap. Your THREAT_MODEL.md becomes the next cohort's starting template

## Congratulations

You shipped a hardened autonomous agent on Google Cloud. That's a real artifact. Tell us what you build next.

---

## Appendix A — Files you touched

| File | Role | What you implemented |
|------|------|----------------------|
| `THREAT_MODEL.md` | Threat model | Filled all 12 rows with controls + status |
| `src/server/middleware/admin-auth.ts` | Admin gate | New |
| `src/server/middleware/verify-oidc.ts` | OIDC verifier | New |
| `src/server/routes/cron-fire.ts` | Cron HTTP route | New |
| `src/agent/budget.ts` | BudgetGuard FATAL | Edited — removed silent default |
| `src/lib/dlp.ts` | Cloud DLP redactor | New |
| `src/lib/dlp.test.ts` | DLP tests | New |
| `src/storage/firestore-rules.test.ts` | Rules emulator tests | New |
| `firestore.rules` | Default-deny rules | New |
| `RUNBOOK.md` | Rotation playbook | New |
| `.github/workflows/security.yml` | npm audit in CI | New |

## Appendix B — Troubleshooting

| Issue | Fix |
|-------|-----|
| Daemon won't start: `FATAL: ADMIN_KEY is required` | Generate + bind: `openssl rand -hex 32 \| gcloud secrets create admin-key --data-file=-` then `gcloud run services update ... --update-secrets=ADMIN_KEY=admin-key:latest` |
| `verifyOidc` returns 401 to a real Scheduler call | Audience mismatch. The job's `--oidc-token-audience` must match `$SERVICE_URL` exactly. Re-create the scheduler job. |
| DLP returns 403 on first call | API not enabled. `gcloud services enable dlp.googleapis.com`. |
| Firestore emulator tests pass locally but rules let writes through in prod | Server SDKs use IAM, not rules — rules are defense-in-depth. Check the runtime SA's roles. |
| `npm audit` flags a transitive vuln you can't fix | Add `overrides` in `package.json`, test, document in `THREAT_MODEL.md` row 8. |

## Appendix C — Production hardening (Phase 2, beyond this codelab)

- Workload Identity Federation (kill the SA key file entirely)
- Mutual TLS to internal services
- Cloud Armor for DDoS / WAF
- VPC Service Controls (data exfiltration boundary)
- Backup + DR drill (Firestore export to Cloud Storage, restore to a different region)
- Pen test (third-party, scoped)

These are all reasonable next steps. None is required for a single-tenant agent at workshop scale; all become required as your agent crosses the line from "personal" to "serves people."
