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

1. A **Google Cloud project** with billing enabled (free tier covers nearly everything)
2. The **`gcloud` CLI** authenticated and project set
3. ~$5 of Cloud credit headroom (you'll likely use $0–2)

### Prerequisites

- Completed [Level 3 — The Agent Army](https://github.com/dahabit/adkclaw/tree/main/level_3)
- Working agent with sub-agents, healing, cron
- `gcloud` CLI authenticated: `gcloud auth login` && `gcloud config set project YOUR_PROJECT_ID`
- A working terminal and editor

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
- ~$1 budget for the Cloud Run + Firestore usage during the level

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
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

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

> **Common pitfall**: GCS FUSE has eventual consistency. A write returns before the next read sees it. For the bank (write-once-then-read), this is fine. For session-active state, use Firestore (next section).

## 5. Implement the Firestore session adapter

`SessionStore` was an interface from L1. The SQLite implementation lives in `src/sessions/store.ts`. We add a Firestore implementation in `src/sessions/firestore-store.ts`:

```typescript
import { Firestore } from '@google-cloud/firestore';
import type { SessionStore, Session, Message } from './store.js';

export class FirestoreSessionStore implements SessionStore {
  private readonly db: Firestore;

  constructor() {
    this.db = new Firestore();
  }

  createSession(opts: { key: string; kind: string; channel: string; model: string; parentKey?: string }) {
    const ref = this.db.collection('sessions').doc(opts.key);
    ref.set({
      key: opts.key,
      kind: opts.kind,
      channel: opts.channel,
      model: opts.model,
      parentKey: opts.parentKey ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archivedAt: null,
    });
  }

  appendMessage(sessionKey: string, msg: Omit<Message, 'id'>) {
    const ref = this.db.collection('sessions').doc(sessionKey).collection('messages').doc();
    ref.set({ ...msg, createdAt: Date.now() });
  }

  list(sessionKey: string): Message[] {
    // Note: in production this is async; the L4 adapter buffers reads at session start
    // See src/sessions/firestore-store.ts full version for the real shape
  }

  archiveSession(key: string) {
    this.db.collection('sessions').doc(key).update({ archivedAt: Date.now() });
  }
}
```

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

Initialise Firestore (one-time):

```bash
gcloud firestore databases create --region=$REGION
```

> **Why Firestore for sessions but Cloud Storage for the bank?** Different access patterns. Sessions need indexed queries (`WHERE channel = 'telegram' AND archivedAt IS NULL`). The bank needs full-text grep. Firestore is great at the first; bad at the second.

### Test the adapter

```bash
SESSION_BACKEND=firestore npm test src/sessions/
```

Tests verify both adapters pass the same interface tests — that's the point of the adapter pattern.

## 6. Deploy to Cloud Run

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
  --set-env-vars=SESSION_BACKEND=firestore,WORKSPACE_BUCKET=$BUCKET,WORKSPACE_PATH=/workspace,TELEGRAM_MODE=webhook,DEFAULT_MODEL=gemini-2.5-pro,FALLBACK_MODEL=gemini-2.5-flash
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
| `--max-instances=3` | Caps cost — past 3 instances you're paying real money |
| `--concurrency=10` | Each instance handles up to 10 simultaneous requests |
| `--allow-unauthenticated` | Telegram webhook can't sign requests — the app verifies internally |

> **Common pitfall**: `--allow-unauthenticated` exposes the dashboard publicly too. Phase 2 hardening: add `app.use('/api/admin', authMiddleware)`.

## 7. Switch Telegram to webhook mode

Long-polling is for development; webhooks are for production:

```bash
curl -F "url=$SERVICE_URL/api/telegram" \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
# {"ok":true,"result":true,"description":"Webhook was set"}
```

In `src/channels/telegram.ts`:

```typescript
if (process.env.TELEGRAM_MODE === 'webhook') {
  app.use(this.bot.webhookCallback('/api/telegram'));
} else {
  await this.bot.launch();
}
```

Send a message on Telegram. Your Cloud Run logs (in Cloud Logging) should show the inbound update.

> **Common pitfall**: forgetting to clear the previous webhook before changing it. Telegram allows one webhook per bot. Run `setWebhook` again to overwrite.

## 8. Schedule cron via Cloud Scheduler

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

In `src/server/http.ts`, add the endpoint with OIDC verification:

```typescript
app.post('/api/cron/fire', verifyOidc, async (req, res) => {
  const { jobId } = req.body as { jobId: string };
  await cronEngine.fire(jobId);
  res.json({ ok: true });
});
```

`verifyOidc` is a middleware that extracts the `Authorization: Bearer <jwt>` header and validates it against Google's certs. Requests without a valid token return 401.

For multiple schedules (e.g., different jobs), create one Cloud Scheduler entry per job. Each posts a different `jobId`.

> **Why Cloud Scheduler instead of running `node-cron`?** Cloud Run scales to zero. There's nothing to run cron in. Cloud Scheduler triggers a fresh HTTPS request, which spins up an instance, runs the work, and lets it scale back down.

## 9. Cloud Logging — structured JSON

Replace `console.log` in `src/index.ts` with a structured logger:

```typescript
// src/lib/logger.ts
export function logInfo(message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    severity: 'INFO',
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  }));
}
export function logError(message: string, fields: Record<string, unknown> = {}) {
  console.error(JSON.stringify({
    severity: 'ERROR',
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  }));
}
```

Cloud Logging picks up `severity` and indexes the JSON — you can query:

```
resource.type="cloud_run_revision" severity=ERROR jsonPayload.toolName="web_search"
```

Open the Logs Explorer:
```bash
gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --format=json
```

> **Cost note**: Cloud Logging is free up to 50 GiB/month per project. Workshop traffic stays under 1 GiB easily.

## 10. (Optional) Custom domain

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

## 11. The global moment

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

## 12. Cost reality check

At typical workshop usage:

| Service | Free tier | Your usage | Cost |
|---------|-----------|------------|------|
| Cloud Run | 2 M requests/mo | ~5K | $0 |
| Firestore | 50K reads/20K writes/day | ~10K reads, 4K writes | $0 |
| Cloud Storage | 5 GB | <100 MB | $0 |
| Secret Manager | 6 secrets free | 3 secrets | $0 |
| Cloud Scheduler | 3 jobs free | 1–2 jobs | $0 |
| Cloud Logging | 50 GiB/mo | <1 GiB | $0 |
| **Vertex AI / Gemini** | (paid) | ~30 turns | **~$0.50** |

**Rule of thumb**: infrastructure is free; Gemini is the dominant cost. Cap with `DAILY_TOKEN_BUDGET` in your env vars (`L1.budget.ts` enforces it).

## 13. Light up your Level 4 badge (the final pillar)

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

From `console.log` to globally-reachable autonomous agent in 9.5 hours. You're ready to build.

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

## Appendix B — Cost estimate (Level 4)

| Component | Approximate cost |
|-----------|-----------------|
| Cloud Run (deploy + 5K requests) | $0 (free tier) |
| Firestore (10K reads, 4K writes) | $0 (free tier) |
| Cloud Storage (~100 MB) | $0 (free tier) |
| Secret Manager (3 secrets) | $0 (free tier) |
| Cloud Scheduler (1–2 jobs) | $0 (free tier) |
| Gemini Pro (~30 turns) | ~$1.00 |
| **Total per participant** | **~$1** |

Cumulative through L0–L4: **~$5 per participant** — matching the README cost table.

## Appendix C — Troubleshooting

| Issue | Fix |
|-------|-----|
| Cold start 10s+ | Set `--min-instances=1` (~$15/month per warm instance) for production |
| Telegram delivers nothing | Webhook URL not set or pointing at wrong host. Re-run `setWebhook`. |
| Cloud Scheduler returns 401 | OIDC service account missing `roles/run.invoker`. Grant it. |
| Firestore reads spike cost | Audit dump missing `limit()`. Add pagination. |
| GCS FUSE shows stale files | Eventual consistency. Add in-process cache for read-after-write of bank entries. |
| `npm test` fails on Firestore adapter | You don't have the Firestore emulator. Run `gcloud emulators firestore start` and set `FIRESTORE_EMULATOR_HOST`. |
| Build fails: "Playwright base too large" | Cloud Build region doesn't have it cached. Switch to `us-central1` or `europe-west1`. |
| Memory hits 2 GB | Playwright + a heavy `web_fetch` can spike. Bump to `--memory=4Gi`. |

## Appendix D — Production hardening (Phase 2)

After the workshop, before you ship to real users:

- **Auth on `/api/admin/*`** — currently public. Add Cloud Run IAP or app-level auth.
- **Per-user rate limit** — add a Redis-backed rate limiter (or use Cloud Tasks with concurrency limits).
- **Input validation on `/api/cron/fire`** — currently trusts the JWT. Validate `jobId` against a whitelist.
- **Backup strategy** — Firestore daily exports to Cloud Storage. Built into gcloud.
- **Monitoring + alerts** — Cloud Monitoring uptime checks on `/api/health`. Alert on >1% 5xx.
- **PII scrubbing** — strip emails / phone numbers from logs before they hit Cloud Logging.

These are excluded from the codelab to keep teaching time focused. Ship them before traffic.
