author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community)
summary: Containerise the agent, move secrets to Secret Manager, migrate workspace to Cloud Storage and sessions to Firestore, deploy to Cloud Run, switch Telegram to webhook mode, schedule cron via Cloud Scheduler. Your agent gets a public HTTPS URL and survives losing your laptop.
id: adkclaw-codelab-4-cloud-deploy
categories: ai,ml,gemini,adk,typescript,nodejs,agents,cloud-run,firestore,gcp
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 4 — Ship to the Cloud

## Before you begin

In Levels 1–3 your agent has lived on your laptop. When the laptop sleeps, the agent sleeps. When you board a plane, it stops. Today we change that. By the end of this codelab your agent has a public HTTPS URL, runs on Google Cloud, scales to zero between turns, and remains reachable from any phone on Earth. This is **Level 4 of 5** in the AdkClaw series — the final level.

**PLEASE READ:** This codelab requires real Google Cloud usage and assumes you have:

1. A **Google Cloud project** with billing enabled (free tier covers the workshop comfortably)
2. The **`gcloud` CLI** authenticated and project set
3. The L1 `BudgetGuard` wired in production (caps Gemini token spend per day)

### Prerequisites

- Completed [Level 3 — The Agent Army](https://github.com/dahabit/adkclaw/tree/main/level_3)
- Working agent with sub-agents, healing, cron
- `gcloud` CLI authenticated: `gcloud auth login` && `gcloud config set project YOUR_PROJECT_ID`
- A working terminal and editor

> **Before you start — verify model IDs:** the deploy command below pins `gemini-3.1-pro-preview` and `gemini-3-flash-preview` (current as of 2026-05-08). Google deprecates older Gemini generations on a published cadence (`gemini-2.5-pro/flash` shut down Oct 16, 2026). Check [the current stable model IDs](https://ai.google.dev/gemini-api/docs/models) before running the cohort and update `workshop.config.json` + the `--set-env-vars` block accordingly. The API surface is stable across generations — only the model strings change.

### What you will learn

- **Containerisation** — multi-stage Dockerfile with Playwright base image
- **Cloud Run deployment** — `gcloud run deploy --source=.` flow, env vars, secrets, scaling
- **Secret Manager** — moving `.env` keys to mounted secrets
- **Cloud Storage workspace** — bucket layout for `workspace/bank/` + `workspace/skills/`
- **Firestore migration** — adapter pattern: same `SessionStore` interface, two backends
- **Telegram webhook mode** — replacing long-polling with `setWebhook`
- **Cloud Scheduler** — external HTTPS triggers replacing in-process `node-cron`
- **OIDC verification** — authenticating Cloud Scheduler requests
- **Cloud Logging** — structured JSON logs to stdout, log-based metrics, queryable
- **Cost optimisation** — `--max-instances`, `--concurrency`, free-tier coverage
- **Custom domain mapping** — `agent.adkclaw.dev` style with auto-provisioned SSL

### What you will need

- A computer with **Node.js 22+** + Docker installed (or Cloud Shell — Docker pre-installed)
- The Level 3 codebase
- A Google Cloud project (`gcloud projects list` to verify)
- A free [Gemini API key](https://aistudio.google.com/apikey)
- A [Telegram bot token](https://t.me/BotFather)
- Cloud Run + Firestore usage stays inside the free tier for typical workshop traffic

## Introduction

Three levels in, your agent is **functional but tethered**. The brain runs on `node`, the memory lives in SQLite, the cron lives in `node-cron`, the channel uses Telegram long-polling — every component holds open a process you control. Today you cut every one of those tethers.

Three architectural shifts:

1. **Stateless compute** — Cloud Run scales to zero between turns. Each request is a fresh container instance reading state from durable backends.
2. **Durable state** — Firestore for sessions + cron jobs (replacing SQLite); Cloud Storage for the workspace files (replacing the local filesystem).
3. **External triggers** — Cloud Scheduler fires HTTPS requests at the agent (replacing `node-cron`); Telegram webhook mode delivers messages via HTTPS (replacing long-polling).

Three observability shifts:
- **Cloud Logging** for structured logs (JSON to stdout)
- **Secret Manager** for `.env` (mounted as env vars)
- **Custom domain** with auto-SSL (optional but cheap and fast)

By the end you can throw your laptop in a lake. Your agent runs on Google's infrastructure, charged in milliseconds, scaled by traffic, surviving any reboot.

### What you will build

By the end of this codelab, you will have:

- A multi-stage `Dockerfile` producing a ~1 GB Cloud Run image
- Three secrets in Secret Manager (Gemini key, Telegram token, allowlist)
- A Cloud Storage bucket holding `workspace/`
- A Firestore database with collections for sessions, messages, and cron jobs
- A live Cloud Run service at `https://adkclaw-<id>.<region>.run.app`
- A Telegram webhook delivering messages directly to your service
- Cloud Scheduler jobs replacing in-process `node-cron`
- Structured JSON logs in Cloud Logging
- A passing `npm test` (~120 tests across the new adapters)
- (Optional) A custom domain with auto-provisioned SSL

## 1. Branch, verify, and prepare

```bash
cd ~/adkclaw/codelab/starter   # or your L3 directory
source ~/adkclaw/set_env.sh
git checkout -b level-4
npm test                       # all L3 tests must still pass
npm run typecheck
```

Set up your Google Cloud variables:

```bash
export PROJECT_ID="$(gcloud config get-value project)"
export PROJECT_NUMBER="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
export REGION="us-central1"      # pick the region closest to your users
export SERVICE="adkclaw"
export BUCKET="adkclaw-ws-${PROJECT_ID}"
```

Enable the required APIs (one-time):

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com
```

> **Cost note**: enabling APIs is free. You only pay when you use them.

## 2. Containerise

Open `Dockerfile` and verify the multi-stage layout:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/workspace.example ./workspace.example
# Defence-in-depth: drop root before running the agent process
RUN useradd -m -u 1000 agent && chown -R agent:agent /app
USER agent
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

> **Why a non-root `USER`:** Cloud Run's gVisor sandbox is strong, but if a tool with shell access (`shell`, `code_fix`) is exploited, running as a non-root user contains the blast radius. Belt and braces — no reason to run as root.

Why Playwright base image? Because we need browser tools (`browser_fetch`, `browser_screenshot`, `browser_pdf`) and the official Playwright image ships with Chromium, FFmpeg, all the system libs. ~700 MB base — tolerable for Cloud Run.

`.dockerignore`:

```
node_modules
data
workspace
.env
.git
*.md
dist
```

Build and test locally:

```bash
docker build -t adkclaw:cl4 .
docker run --rm -p 8080:8080 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -e PORT=8080 \
  adkclaw:cl4
curl localhost:8080/api/health   # should return {"ok":true}
```

> **Common pitfall**: forgetting `PORT=8080`. Cloud Run sets `PORT` and the app must bind to it. Don't hardcode 3000.

## 3. Move secrets to Secret Manager

Your `.env` has three keys. They become three Secret Manager secrets:

```bash
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "$TELEGRAM_BOT_TOKEN" | gcloud secrets create telegram-bot-token --data-file=-
echo -n "$ALLOWED_SENDERS" | gcloud secrets create allowed-senders --data-file=-
```

Grant the Cloud Run service account access:

```bash
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for SECRET in gemini-api-key telegram-bot-token allowed-senders; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

> **Why three secrets, not one?** Rotating a single key shouldn't force re-deploying everything that uses the others.
>
> **Rotation cadence (preview — full playbook in Phase 2 hardening):** rotate `gemini-api-key` annually, `telegram-bot-token` every 6 months (or after onboarding handoff), `allowed-senders` whenever your contributor list changes. Cloud Run picks up `:latest` automatically — no redeploy needed for rotation, just `gcloud secrets versions add <secret> --data-file=-` and let Cloud Run refresh on next cold start (or trigger explicitly with `gcloud run services update --update-secrets=...`).

## 4. Migrate workspace to Cloud Storage

Cloud Run is stateless — local files vanish between requests. The workspace lives in a bucket:

```bash
gcloud storage buckets create "gs://$BUCKET" --location=$REGION
gcloud storage cp -r workspace/* "gs://$BUCKET/"
gcloud storage ls "gs://$BUCKET/"
```

Two access patterns:
- **GCS FUSE mount** (Cloud Run gen2 supports this) — workspace appears as a real filesystem at `/workspace/`
- **GCS SDK** (more code, more control) — explicit reads/writes via `@google-cloud/storage`

For L4 we use **GCS FUSE** — it's a one-liner in the deploy command, and the existing `ContextEngine` code works unchanged.

In `cloudbuild.yaml` (or the deploy command in §6), add the volume mount:

```yaml
volumes:
- name: ws-volume
  csi:
    driver: gcsfuse.run.googleapis.com
    volumeAttributes:
      bucketName: ${_BUCKET}
volumeMounts:
- name: ws-volume
  mountPath: /workspace
```

Then `WORKSPACE_PATH=/workspace` becomes the new env var.

> **GCS FUSE eventual consistency (read this carefully):** writes return before the next read sees them. Typical propagation is <2 seconds, but spikes to 5–10s do happen. For the bank — where the write-then-read flow is "user tells the agent something → the agent saves it → the user asks about it ten seconds later" — this is **acceptable**. For tighter loops (the agent saves a fact, then immediately reads the bank index in the next turn), add one of:
>
> 1. **In-process write-through cache** — the `MemoryBank` keeps a recently-written set in memory; reads check there before hitting GCS.
> 2. **Read-after-write retry** — `MemoryBank.read()` retries with backoff if the file isn't visible (1s, 2s, 4s).
> 3. **Switch to the GCS SDK** with explicit reads — slower for bulk operations but lets you `if-not-exists` retry cleanly.
>
> For session-active state (messages, cron metadata), use **Firestore** (next section) — it has strong consistency guarantees within a region.

## 5. Implement the Firestore session adapter

`SessionStore` was an interface from L1. The SQLite implementation lives in `src/sessions/store.ts`. We add a Firestore implementation in `src/sessions/firestore-store.ts`.

> **Async boundary you cannot ignore:** SQLite (`better-sqlite3`) is **synchronous** — `list()` returns `Message[]`. Firestore is **async** — it returns `Promise<Message[]>`. The runner's hot loop expects sync reads, so the Firestore adapter has two honest choices:
>
> 1. **Make `SessionStore` async everywhere** — change the interface to `Promise<Message[]>`, propagate `await` through the runner. Cleanest, biggest diff.
> 2. **Buffer reads at session start** — when a session opens, the adapter prefetches its messages into an in-memory array; the rest of the turn reads from the buffer; appends are async-fire-and-forget with eventual write-through.
>
> The production implementation uses **option 2**. The shape below shows the real interface (note `loadSession` is async, but `list` returns the buffered slice synchronously):

```typescript
import { Firestore } from '@google-cloud/firestore';
import type { SessionStore, Session, Message } from './store.js';

export class FirestoreSessionStore implements SessionStore {
  private readonly db: Firestore;
  private readonly buffers = new Map<string, Message[]>();

  constructor() {
    this.db = new Firestore();
  }

  /** Call this before every turn — prefetches the session's message history. */
  async loadSession(sessionKey: string): Promise<void> {
    const snap = await this.db
      .collection('sessions').doc(sessionKey).collection('messages')
      .orderBy('createdAt').limit(200).get();
    this.buffers.set(sessionKey, snap.docs.map((d) => d.data() as Message));
  }

  createSession(opts: { key: string; kind: string; channel: string; model: string; parentKey?: string }) {
    void this.db.collection('sessions').doc(opts.key).set({
      key: opts.key,
      kind: opts.kind,
      channel: opts.channel,
      model: opts.model,
      parentKey: opts.parentKey ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archivedAt: null,
    });
    this.buffers.set(opts.key, []);
  }

  appendMessage(sessionKey: string, msg: Omit<Message, 'id'>) {
    // Update buffer synchronously, write-through to Firestore async (fire-and-forget)
    const buf = this.buffers.get(sessionKey) ?? [];
    buf.push({ ...msg, id: '' } as Message);
    this.buffers.set(sessionKey, buf);
    void this.db
      .collection('sessions').doc(sessionKey).collection('messages').doc()
      .set({ ...msg, createdAt: Date.now() });
  }

  list(sessionKey: string): Message[] {
    return this.buffers.get(sessionKey) ?? [];
  }

  archiveSession(key: string) {
    void this.db.collection('sessions').doc(key).update({ archivedAt: Date.now() });
  }
}
```

The runner is updated to call `await sessions.loadSession(sessionKey)` before each turn — that's the only async boundary the adapter introduces. **Failure mode:** if Firestore times out during `loadSession`, the runner gets an empty buffer and the turn proceeds with no history (the agent will reintroduce itself). The `HealingEngine.withRetry` from L3 wraps the load to absorb transient failures.

A factory picks the backend by env:

```typescript
// src/sessions/store-factory.ts
export function createSessionStore(): SessionStore {
  if (process.env.SESSION_BACKEND === 'firestore') {
    return new FirestoreSessionStore();
  }
  return new SqliteSessionStore({
    databasePath: process.env.DATABASE_PATH ?? 'data/adkclaw.db',
  });
}
```

In `src/index.ts`:

```typescript
const sessions = createSessionStore();
```

### Initialise Firestore — must happen before deploy

```bash
# Idempotent: succeeds whether or not the DB already exists.
gcloud firestore databases describe --region=$REGION >/dev/null 2>&1 || \
  gcloud firestore databases create --region=$REGION
```

> ⚠️ **Do this step before `gcloud run deploy`.** If you deploy first, Cloud Run cold-start will hang waiting for a Firestore database that doesn't exist, and the failure surfaces only as a 503 with no useful logs. We've all done it. Don't.

> **Why Firestore for sessions but Cloud Storage for the bank?** Different access patterns. Sessions need indexed queries (`WHERE channel = 'telegram' AND archivedAt IS NULL`). The bank needs full-text grep. Firestore is great at the first; bad at the second.

### Test the adapter

The Firestore adapter tests need the **Firestore emulator** running locally — otherwise they silently connect to your real GCP Firestore (slow, costs money, pollutes prod).

```bash
# In a SECOND terminal (leave it running):
gcloud emulators firestore start --host-port=localhost:8080

# In your normal terminal:
export FIRESTORE_EMULATOR_HOST=localhost:8080
SESSION_BACKEND=firestore npm test src/sessions/
```

Tests verify both adapters pass the same interface tests — that's the point of the adapter pattern.

> ⚠️ **Common trap:** if `FIRESTORE_EMULATOR_HOST` is unset, the SDK falls back to your authenticated GCP project. If your test does a `db.collection('sessions').get()`, it pulls real production sessions. Always export the env var in the same shell as `npm test`.

## 6. Pre-flight security checklist (do this before deploy)

Before `gcloud run deploy`, verify all six gates are wired. Each one is **mandatory** for a publicly-reachable agent. If any is missing, fix it before deploying — Cloud Run with `--allow-unauthenticated` amplifies every defect.

- [ ] **Admin auth on `/`** — dashboard route checks an admin key. If not, the route must return 401 unconditionally.
- [ ] **OIDC verification on `/api/cron/fire`** — the middleware in `src/server/oidc.ts` is wired in your route stack. Test: `curl -X POST $SERVICE_URL/api/cron/fire` should return **401**.
- [ ] **Telegram webhook secret-token validation** — `setWebhook` was called with a `secret_token`, and your handler rejects mismatching `X-Telegram-Bot-Api-Secret-Token` headers.
- [ ] **`BudgetGuard` is FATAL on missing config** — daemon refuses to start without a `DAILY_TOKEN_BUDGET`.
- [ ] **`ALLOWED_SENDERS` is set** to your numeric Telegram ID (and you can list extra IDs comma-separated). Empty = bot rejects everything silently.
- [ ] **`.gitignore` blocks `.env`, `set_env.sh`, `agent.yaml`, `data/`, `workspace/`** — verify with `git status` showing none of those.

If any are red, the agent is not ready for the public internet. Fix, then deploy.

## 7. Deploy to Cloud Run

The big moment:

```bash
gcloud run deploy $SERVICE \
  --source=. \
  --region=$REGION \
  --memory=2Gi \
  --cpu=2 \
  --max-instances=3 \
  --concurrency=10 \
  --allow-unauthenticated \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,ALLOWED_SENDERS=allowed-senders:latest \
  --set-env-vars=SESSION_BACKEND=firestore,WORKSPACE_BUCKET=$BUCKET,WORKSPACE_PATH=/workspace,TELEGRAM_MODE=webhook,DEFAULT_MODEL=gemini-3.1-pro-preview,FALLBACK_MODEL=gemini-3-flash-preview
```

`--source=.` triggers Cloud Build to:
1. Read the `Dockerfile`
2. Build the image
3. Push it to Artifact Registry (auto-configured)
4. Deploy to Cloud Run

After ~3–5 minutes:

```
Service URL: https://adkclaw-abc123-uc.a.run.app
```

Capture it:

```bash
SERVICE_URL=$(gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)')
echo $SERVICE_URL
```

Smoke-test:

```bash
curl $SERVICE_URL/api/health   # {"ok":true}
```

### Why these flags

| Flag | Why |
|------|-----|
| `--memory=2Gi` | Playwright + Gemini Pro context comfortably fits in 2 GB |
| `--cpu=2` | 2 vCPU lets the agent loop run while a tool call is in flight |
| `--max-instances=2` | Caps cost — past 2 instances you're paying real money. **Workshop default.** Increase to 5–10 only after you've verified your agent's behaviour under load. |
| `--concurrency=5` | Each instance handles up to 5 simultaneous requests. Tighter than the Cloud Run default (80) on purpose — agent turns are CPU-heavy and a runaway loop hitting concurrency=10 burns through tokens fast. |
| `--allow-unauthenticated` | Required for Telegram webhook delivery. **The dashboard is exposed too — see security note immediately below.** |

### 6.5 — Lock down the dashboard before any traffic hits

`--allow-unauthenticated` exposes **every route**, including the L3 admin dashboard at `/` and `/api/admin/*` (which surfaces session keys, message counts, cron jobs, and tokens consumed). **Add admin auth before sending real users to your URL** — this is not a Phase 2 item, it's day-one.

In `src/server/middleware/admin-auth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return res.status(503).json({ error: 'ADMIN_KEY not configured' });
  const provided = (req.header('x-admin-key') ?? '').toString();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

Wire it in `src/server/http.ts` **before** the dashboard routes:

```typescript
app.use('/api/admin', adminAuth);
app.get('/', adminAuth, (_req, res) => res.send(DASHBOARD_HTML));
```

Add to Secret Manager and the deploy command:

```bash
echo -n "$(openssl rand -hex 32)" | gcloud secrets create admin-key --data-file=-
gcloud secrets add-iam-policy-binding admin-key --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
# Re-deploy with the new secret mounted
gcloud run services update $SERVICE --region=$REGION --update-secrets=ADMIN_KEY=admin-key:latest
```

Now you visit the dashboard with `curl -H "x-admin-key: $(gcloud secrets versions access latest --secret=admin-key)" $SERVICE_URL/` (or paste it as a header in your browser via an extension). Telegram and `/api/cron/fire` are unaffected — those have their own verification (next sections).

> **Cost-runaway guard:** even with `--max-instances=2 --concurrency=5`, a buggy agent looping on `spawn_agent` can chew through Gemini tokens fast. Keep the L1 `BudgetGuard` (`DAILY_TOKEN_BUDGET=100000`) wired in production, and set a Cloud Billing budget alert at a level that's painful to ignore so you find out before the bill becomes the lesson.

## 8. Switch Telegram to webhook mode (with secret token)

Long-polling is for development; webhooks are for production. Telegram supports a per-webhook **secret token** — every inbound POST carries an `X-Telegram-Bot-Api-Secret-Token` header that telegraf validates automatically. Set it.

Generate the secret and store it:

```bash
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo -n "$TELEGRAM_WEBHOOK_SECRET" | gcloud secrets create telegram-webhook-secret --data-file=-
gcloud secrets add-iam-policy-binding telegram-webhook-secret --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud run services update $SERVICE --region=$REGION --update-secrets=TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret:latest
```

Register the webhook **with** the secret token:

```bash
curl -F "url=$SERVICE_URL/api/telegram" \
     -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
     https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
# {"ok":true,"result":true,"description":"Webhook was set"}
```

In `src/channels/telegram.ts`, configure telegraf to validate it:

```typescript
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

if (process.env.TELEGRAM_MODE === 'webhook') {
  // telegraf auto-validates the X-Telegram-Bot-Api-Secret-Token header
  // against the secret passed here. Mismatched headers → 403, dropped silently.
  app.use(bot.webhookCallback('/api/telegram', {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  }));
} else {
  await bot.launch();
}
```

> **Why the secret token matters:** without it, anyone who guesses your `/api/telegram` URL can POST fake updates and impersonate Telegram. With the token, only POSTs whose header matches your secret are accepted. **Telegraf does the validation — do NOT roll your own HMAC verification.**

Send a message on Telegram. Your Cloud Run logs should show the inbound update with `severity=INFO`.

> **Common pitfall**: forgetting to clear the previous webhook before changing it. Telegram allows one webhook per bot. Run `setWebhook` again to overwrite. To check current state: `curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo`.

## 9. Schedule cron via Cloud Scheduler

`node-cron` runs in-process. On Cloud Run, the process dies when it scales to zero. Cloud Scheduler is the external trigger:

```bash
gcloud scheduler jobs create http adkclaw-heartbeat \
  --location=$REGION \
  --schedule="*/30 * * * *" \
  --uri="$SERVICE_URL/api/cron/fire" \
  --http-method=POST \
  --oidc-service-account-email="$SA" \
  --message-body='{"jobId":"heartbeat"}'
```

In `src/server/middleware/oidc.ts`, implement the OIDC verifier — **do not skip this**, an unverified `/api/cron/fire` is a public RCE-on-cron endpoint:

```typescript
import { OAuth2Client } from 'google-auth-library';
import type { Request, Response, NextFunction } from 'express';

const googleClient = new OAuth2Client();

export async function verifyOidc(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'missing bearer token' });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: match[1],
      audience: process.env.SERVICE_URL,   // your Cloud Run URL
    });
    const payload = ticket.getPayload();
    const expectedSa = process.env.CRON_SERVICE_ACCOUNT;
    if (!payload || (expectedSa && payload.email !== expectedSa)) {
      return res.status(403).json({ error: 'wrong service account' });
    }
    (req as any).oidc = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}
```

Then in `src/server/http.ts`:

```typescript
import { verifyOidc } from './middleware/oidc.js';

app.post('/api/cron/fire', verifyOidc, async (req, res) => {
  const { jobId } = req.body as { jobId: string };
  // Validate jobId against a whitelist before firing — never trust the body
  if (!cronEngine.has(jobId)) return res.status(404).json({ error: 'unknown jobId' });
  await cronEngine.fire(jobId);
  res.json({ ok: true });
});
```

Set the env vars on the deployed service:

```bash
gcloud run services update $SERVICE --region=$REGION \
  --update-env-vars=SERVICE_URL=$SERVICE_URL,CRON_SERVICE_ACCOUNT=$SA
```

Test that unauthorised requests are rejected:

```bash
# No token → 401
curl -X POST $SERVICE_URL/api/cron/fire -d '{"jobId":"heartbeat"}'
# Wrong audience → 401
# Wrong SA → 403
```

For multiple schedules (e.g., different jobs), create one Cloud Scheduler entry per job. Each posts a different `jobId`.

> **Why Cloud Scheduler instead of running `node-cron`?** Cloud Run scales to zero. There's nothing to run cron in. Cloud Scheduler triggers a fresh HTTPS request, which spins up an instance, runs the work, and lets it scale back down.

## 10. Cloud Logging — structured JSON with PII redaction

Replace `console.log` in `src/index.ts` with a structured logger that **redacts PII before logging**. Cloud Logging is searchable; an email or phone number in a tool result will sit there indexed for 30 days. Redact at the boundary.

```typescript
// src/lib/logger.ts
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;
const TOKEN_RE = /\b(sk-|pk-|ya29\.|AIza|gho_|ghs_)[A-Za-z0-9_-]{16,}/g;
const CARD_RE = /\b(?:\d[ -]*?){13,16}\b/g;

export function redactPII(input: unknown): unknown {
  if (typeof input === 'string') {
    return input
      .replace(EMAIL_RE, '[email]')
      .replace(PHONE_RE, '[phone]')
      .replace(TOKEN_RE, '[token]')
      .replace(CARD_RE, '[card]');
  }
  if (Array.isArray(input)) return input.map(redactPII);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = redactPII(v);
    return out;
  }
  return input;
}

function emit(severity: 'INFO' | 'WARNING' | 'ERROR', message: string, fields: Record<string, unknown>) {
  const stream = severity === 'ERROR' ? console.error : console.log;
  stream(JSON.stringify({
    severity,
    message: redactPII(message) as string,
    timestamp: new Date().toISOString(),
    ...(redactPII(fields) as Record<string, unknown>),
  }));
}

export const logInfo = (msg: string, fields: Record<string, unknown> = {}) => emit('INFO', msg, fields);
export const logWarn = (msg: string, fields: Record<string, unknown> = {}) => emit('WARNING', msg, fields);
export const logError = (msg: string, fields: Record<string, unknown> = {}) => emit('ERROR', msg, fields);
```

> **What this redacts and what it doesn't:** the regexes catch the common shapes (Gmail-style emails, phone numbers, API-key prefixes, plain card numbers). They will NOT catch addresses, names, or messages where PII is expressed in prose ("my friend Sara at 5 Cedar Lane..."). For workshop traffic this is fine; for regulated workloads add a more sophisticated DLP step (e.g. Cloud DLP API).

Cloud Logging picks up `severity` and indexes the JSON — you can query:

```
resource.type="cloud_run_revision" severity=ERROR jsonPayload.toolName="web_search"
```

Open the Logs Explorer:
```bash
gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --format=json
```

> **Cost note**: Cloud Logging is free up to 50 GiB/month per project. Workshop traffic stays under 1 GiB easily.

## 11. (Optional) Custom domain

If you have a domain (e.g., `adkclaw.dev`), map a subdomain:

```bash
gcloud beta run domain-mappings create \
  --service=$SERVICE \
  --domain=agent.adkclaw.dev \
  --region=$REGION
```

This prints the DNS records to add at your registrar (`A` and `AAAA` records pointing to Google's IPs):

```
agent.adkclaw.dev   A    216.239.32.21
agent.adkclaw.dev   A    216.239.34.21
agent.adkclaw.dev   A    216.239.36.21
agent.adkclaw.dev   A    216.239.38.21
```

Add them at your registrar (name.com, Cloudflare, Route 53, whatever you use). Wait ~5 minutes. SSL auto-provisions. You now have `https://agent.adkclaw.dev`.

Re-register the Telegram webhook with the new URL:

```bash
curl -F "url=https://agent.adkclaw.dev/api/telegram" \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
```

> **Why custom domain?** Branded URLs are easier to share. SSL is auto-provisioned and free.

## 12. The global moment

Open Telegram on your phone:

```
You: Hi from anywhere on Earth!
Bot: Welcome — I live in Google Cloud now. ❤️
```

Close your laptop. Throw it in a lake (metaphorically).

```
You: Are you still alive?
Bot: Of course. I'm not on your laptop anymore.
```

Cold start ~2–3 seconds the first message after idle. Subsequent messages instant.

## 13. Stay inside the free tier

At typical workshop usage, every Google Cloud service used here sits inside the free tier:

| Service | Free tier (typical workshop usage stays well below) |
|---------|---|
| Cloud Run | 2 M requests / month |
| Firestore | 50K reads / 20K writes per day |
| Cloud Storage | 5 GB |
| Secret Manager | 6 secrets |
| Cloud Scheduler | 3 jobs |
| Cloud Logging | 50 GiB / month |
| Vertex AI / Gemini | Free tier covers normal testing; cap with `DAILY_TOKEN_BUDGET` |

**Rule of thumb**: infrastructure is free at workshop scale; Gemini is the dominant variable cost. Cap with `DAILY_TOKEN_BUDGET` in your env vars (`L1.budget.ts` enforces it).

## 14. Light up your Level 4 badge (the final pillar)

**Trigger**: deployment completes and `gcloud run services describe` returns a public HTTPS URL. The agent calls `mark_level_complete` with `level: 4`, `region`, and `publicAgentUrl` so the platform can verify and display your live URL on `adkclaw.dev/u/<your-username>`.

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox), all four pillars light up — you're on the leaderboard, your agent is publicly addressable, and you can hand the URL to a friend.

## What you have now

You walked in knowing how to call an LLM. You're walking out with:

- A globally addressable autonomous agent on Cloud Run
- Persistent memory in Firestore + Cloud Storage
- Webhook-driven Telegram delivery
- Cloud Scheduler-triggered cron jobs
- Structured logs in Cloud Logging
- Optional custom domain with auto-SSL

The repo is yours. Fork it, rename the agent, add tools, ship something different. The five-level scaffold maps to a different domain than yours; **make it yours**.

## What's next

You finished the foundation. Where to go from here:

- **Build something with it.** The repo is yours — fork, rename, deploy. Add a Slack channel. Wire it into your calendar. Make it write code reviews.
- **Stretch tracks** (Part 2 of the curriculum, post-Cohort-1 selection):
  - **Coder** — pair-programmer agent with tight git/test loops
  - **Researcher** — long-form RAG over your Notion/Docs
  - **Voice Tutor** — Gemini Live API for bidirectional voice
  - **Productivity Operator** — calendar + email + Slack delegate
  - **Multi-Agent Orchestrator** — graph-framework patterns
- **Contribute back** — PRs welcome at [github.com/dahabit/adkclaw](https://github.com/dahabit/adkclaw)
- **Teach it** — the curriculum is Apache 2.0. Run your own cohort.

## Congratulations

From `console.log` to globally-reachable autonomous agent across the workshop. You're ready to build.

---

## Appendix A — Files you touched

| File | Role | What you implemented |
|------|------|----------------------|
| `Dockerfile` | Multi-stage build with Playwright base | All four stages |
| `.dockerignore` | Exclude `node_modules`, `data`, `.env` | New file |
| `cloudbuild.yaml` | (optional) automated builds | Substrate config |
| `deploy/secrets.sh` | Create the three secrets | Helper script |
| `deploy/workspace-bucket.sh` | Create the GCS bucket + upload `workspace/` | Helper script |
| `deploy/scheduler-jobs.sh` | Create Cloud Scheduler entries | Helper script |
| `deploy/register-webhook.sh` | Set Telegram webhook post-deploy | Helper script |
| `src/sessions/firestore-store.ts` | Firestore adapter | Full implementation |
| `src/sessions/store-factory.ts` | Pick SQLite vs Firestore by env | New |
| `src/storage/gcs.ts` | (optional) Cloud Storage SDK adapter | Optional helper |
| `src/lib/logger.ts` | Structured JSON logger for Cloud Logging | New |

## Appendix B — Troubleshooting

| Issue | Fix |
|-------|-----|
| Cold start 10s+ | Set `--min-instances=1` for production — warm instances bill continuously, so size to demand |
| Telegram delivers nothing | Webhook URL not set or pointing at wrong host. Re-run `setWebhook`. |
| Cloud Scheduler returns 401 | OIDC service account missing `roles/run.invoker`. Grant it. |
| Firestore reads spike cost | Audit dump missing `limit()`. Add pagination. |
| GCS FUSE shows stale files | Eventual consistency. Add in-process cache for read-after-write of bank entries. |
| `npm test` fails on Firestore adapter | You don't have the Firestore emulator. Run `gcloud emulators firestore start` and set `FIRESTORE_EMULATOR_HOST`. |
| Build fails: "Playwright base too large" | Cloud Build region doesn't have it cached. Switch to `us-central1` or `europe-west1`. |
| Memory hits 2 GB | Playwright + a heavy `web_fetch` can spike. Bump to `--memory=4Gi`. |

## Appendix C — Production hardening (Phase 2)

After the workshop, before you ship to real users:

- **Auth on `/api/admin/*`** — currently public. Add Cloud Run IAP or app-level auth.
- **Per-user rate limit** — add a Redis-backed rate limiter (or use Cloud Tasks with concurrency limits).
- **Input validation on `/api/cron/fire`** — currently trusts the JWT. Validate `jobId` against a whitelist.
- **Backup strategy** — Firestore daily exports to Cloud Storage. Built into gcloud.
- **Monitoring + alerts** — Cloud Monitoring uptime checks on `/api/health`. Alert on >1% 5xx.
- **PII scrubbing** — strip emails / phone numbers from logs before they hit Cloud Logging.

These are excluded from the codelab to keep teaching time focused. Ship them before traffic.
