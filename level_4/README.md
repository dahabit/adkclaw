# Level 4: Ship to the Cloud

![Level 4: Ship to the Cloud](img/cloud-architecture.png)

**Take your laptop-bound agent and put it on Google Cloud — globally reachable, auto-scaled, surviving any reboot.**

Three levels in, your agent lives on your laptop. When your laptop sleeps, the agent sleeps. When you board a plane, it stops. Today we change that. You'll containerize the agent, mount its workspace on Cloud Storage, store its sessions in Firestore, hide its secrets in Secret Manager, schedule its cron jobs with Cloud Scheduler, and deploy the whole thing to Cloud Run. By the end, your agent has a public HTTPS URL, your phone can reach it from anywhere on Earth, and your laptop can fall in a lake without consequence.

## 🎯 What You'll Learn

| Concept | Description |
|---------|-------------|
| **Containerization** | Multi-stage Dockerfile with Playwright base image |
| **Cloud Run deployment** | `gcloud run deploy --source=.` flow |
| **Secret Manager** | Move `.env` → mounted env vars |
| **Cloud Storage workspace** | GCS FUSE mount for `workspace/` files |
| **Firestore migration** | Adapter pattern: same `SessionStore` interface, two backends |
| **Telegram webhook mode** | Replace long-polling with `setWebhook` |
| **Cloud Scheduler** | External cron triggers HTTPS endpoint |
| **OIDC verification** | Authenticate Cloud Scheduler requests |
| **Cloud Logging** | Structured logs, log-based metrics, queryable |
| **Cost optimization** | `--max-instances`, `--concurrency`, free-tier coverage |

## ✅ What You'll Build

By the end of this level, you will have:

- 🐳 A multi-stage Dockerfile producing a ~1GB Cloud Run image
- 🔐 Three secrets in Secret Manager (Gemini key, Telegram token, allowlist)
- 🪣 A Cloud Storage bucket holding `workspace/` files
- 🔥 Firestore collections replacing local SQLite
- ☁️ A live Cloud Run service at `https://adkclaw-<id>.a.run.app`
- 🔗 Telegram webhook pointing at your Cloud Run URL
- ⏰ Cloud Scheduler jobs replacing in-process node-cron
- 📈 Structured logs in Cloud Logging
- 🌐 Optional: custom domain via Cloud Run domain mapping

## 📋 Prerequisites

- ✅ **Level 3 completed** — agent runs locally with sub-agents, healing, cron
- ✅ Google Cloud project with **billing enabled** (this level uses paid services, but free tier covers it)
- ✅ `gcloud` CLI authenticated and project set
- ✅ Cloud credits / billing active (free tier covers the workshop comfortably; billing must be enabled to call paid APIs)

## 🚀 Quick Start

### 1. Clone and verify

```bash
cd ~/adkclaw/codelab/starter  # Level 4 is being migrated from the monolithic starter
source ~/adkclaw/set_env.sh
npm install
npm run typecheck
```

**Note:** Level 1 is now live in the new per-level-starter format (`level_1/starter/`). Levels 2–5 are being migrated and currently still follow this traditional monolithic starter + git-tag-checkpoint model.

### 2. Containerize

Open `Dockerfile`. Multi-stage:
- **base**: `mcr.microsoft.com/playwright:v1.59.1-jammy`
- **deps**: `npm ci`
- **build**: `tsc`
- **runtime**: copy compiled output, expose 8080

```bash
docker build -t adkclaw:cl4 .
docker run --rm -p 3000:3000 -e GEMINI_API_KEY=$GEMINI_API_KEY adkclaw:cl4
curl localhost:3000/api/health
```

### 3. Move secrets to Secret Manager

```bash
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "$TELEGRAM_BOT_TOKEN" | gcloud secrets create telegram-bot-token --data-file=-
echo -n "$ALLOWED_SENDERS" | gcloud secrets create allowed-senders --data-file=-
```

### 4. Migrate workspace to Cloud Storage

```bash
BUCKET="adkclaw-ws-${PROJECT_ID}"
gcloud storage buckets create "gs://$BUCKET" --location=$REGION
gsutil cp -r workspace/* "gs://$BUCKET/"
```

### 5. Implement the Firestore adapter

`src/sessions/firestore-store.ts` — implements the same interface as `SessionStore`, backed by Firestore. Branch on env: `SESSION_BACKEND=firestore` triggers the new adapter.

### 6. Deploy to Cloud Run

```bash
gcloud run deploy adkclaw \
  --source=. \
  --region=$REGION \
  --memory=2Gi \
  --max-instances=3 \
  --concurrency=10 \
  --allow-unauthenticated \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,ALLOWED_SENDERS=allowed-senders:latest \
  --set-env-vars=SESSION_BACKEND=firestore,WORKSPACE_BUCKET=$BUCKET
```

### 7. Switch Telegram to webhook mode

```bash
SERVICE_URL=$(gcloud run services describe adkclaw --region=$REGION --format='value(status.url)')
curl -F "url=$SERVICE_URL/api/telegram" \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
```

### 8. Schedule cron via Cloud Scheduler

```bash
gcloud scheduler jobs create http adkclaw-heartbeat \
  --location=$REGION \
  --schedule="*/30 * * * *" \
  --uri="$SERVICE_URL/api/cron/fire" \
  --http-method=POST \
  --oidc-service-account-email="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
```

### 9. (Optional) Custom domain

If you have a domain (e.g., `agent.adkclaw.dev`):
```bash
gcloud beta run domain-mappings create \
  --service=adkclaw \
  --domain=agent.adkclaw.dev \
  --region=$REGION
```
Add the printed DNS records at your registrar. SSL auto-provisions in ~5 minutes.

### 10. Test the global moment

```
[on Telegram, from your phone]
You: Hi from anywhere on Earth!
Bot: Welcome — I live in Google Cloud now. ❤️

[close laptop, throw it in a lake]

You: Are you still alive?
Bot: Of course. I'm not on your laptop anymore.
```

## 🏆 Light Up Your Level 4 Badge (the final pillar)

**Trigger**: deployment completes and `gcloud run services describe` returns a public HTTPS URL. The agent calls `mark_level_complete` with `level: 4`, `region`, and `publicAgentUrl` so the platform can verify and surface your Cloud Run URL on your profile at `adkclaw.dev/u/<username>`.

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox) (see [Level 0 → Connect to the Cohort Fleet](../level_0/README.md#-optional-connect-to-the-cohort-fleet)), all four pillars light up — you're on the leaderboard. If not registered, no-op.

## 📖 Full Codelab

**[📚 Level 4 Codelab →](https://codelabs.developers.google.com/adkclaw-level-4/instructions)**

## 🏗️ Architecture

```
                              ┌───────────────────────┐
   Telegram (webhook)  ───────▶│   Cloud Run service  │
                              │   adkclaw-<rev>       │ ──▶ Vertex AI (Gemini)
                              │   • AgentRunner       │
                              │   • HealingEngine     │
                              │   • Sub-agents        │
                              └────────┬──────────────┘
              ┌────────────────────────┼─────────────────────────┐
              ▼                        ▼                         ▼
   ┌────────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ Secret Manager     │   │  Firestore       │   │  Cloud Storage   │
   │ • API keys         │   │  • sessions      │   │  • workspace/    │
   │ • allowlist        │   │  • messages      │   │  • bank/         │
   └────────────────────┘   │  • cron_jobs     │   │  • skills/       │
                            │  • cron_runs     │   └──────────────────┘
                            └──────────────────┘

   ┌────────────────────┐
   │ Cloud Scheduler    │ ──HTTPS POST──▶ Cloud Run /api/cron/fire
   └────────────────────┘
```

## 🔑 Key Patterns

### Multi-stage Dockerfile

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
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### Adapter pattern for swappable backends

```typescript
// src/sessions/store-factory.ts
export function createSessionStore(): SessionStore {
  if (process.env.SESSION_BACKEND === 'firestore') {
    return new FirestoreSessionStore();
  }
  return new SqliteSessionStore({ databasePath: process.env.DATABASE_PATH });
}
```

### Telegram webhook mode

```typescript
// src/channels/telegram.ts
if (process.env.TELEGRAM_MODE === 'webhook') {
  app.use(this.bot.webhookCallback('/api/telegram'));
} else {
  await this.bot.launch();
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Cold start takes 10s | Set `--min-instances=1` to keep one warm — warm instances bill continuously, so size to demand |
| Telegram silently delivers nothing | Webhook URL not registered. Re-run `setWebhook`. |
| Cloud Scheduler returns 401 | OIDC service account missing role. Grant `run.invoker` to the SA. |
| Firestore reads spiking cost | Pagination missing in audit dump. Add `limit()` to the query. |
| GCS FUSE shows stale files | Eventual consistency. Add in-process cache for read-after-write. |

## 📁 Files Overview

| File | What you implement |
|------|-------------------|
| `Dockerfile` | Multi-stage build |
| `.dockerignore` | Excludes `node_modules`, `data`, `.env` |
| `cloudbuild.yaml` | (optional) automated builds |
| `deploy/secrets.sh` | Creates the three secrets |
| `deploy/workspace-bucket.sh` | Creates the GCS bucket + uploads workspace |
| `deploy/scheduler-jobs.sh` | Creates Cloud Scheduler entries |
| `deploy/register-webhook.sh` | Registers Telegram webhook post-deploy |
| `src/sessions/firestore-store.ts` | Firestore adapter |
| `src/sessions/store-factory.ts` | Picks SQLite vs Firestore based on env |
| `src/storage/gcs.ts` | (optional) Cloud Storage SDK adapter |
| `src/lib/logger.ts` | Structured logger (JSON to stdout for Cloud Logging) |

## ➡️ What's Next

You've built and shipped an autonomous agent. Where to go from here:

- **Build something with it.** The repo is yours — fork, name it whatever, deploy your own.
- **Stretch ideas:**
  - Add a Slack channel adapter alongside Telegram
  - Add a Gmail tool (read/draft via Google APIs)
  - Add Calendar scheduling
  - Add `image_create` via Vertex Imagen
  - Multi-tenant: namespace `workspace/` per user
- **Contribute back:** PRs welcome at the [AdkClaw repo](https://github.com/dahabit/adkclaw).
- **Teach it:** the curriculum is yours to use. Run your own cohort.

## 🏁 You're done when…

- [ ] Anonymous `curl -X POST $SERVICE_URL/api/cron/fire` returns **401**
- [ ] Authorised Cloud Scheduler invocation returns **200** and runs the job exactly once
- [ ] Telegram message routes through the webhook (not polling) — check `getWebhookInfo`
- [ ] Service scales to **zero** between requests (`gcloud run services describe` shows 0 instances after a minute idle)
- [ ] `BudgetGuard`, admin auth on `/`, and OIDC on `/api/cron/fire` are **all wired and FATAL on startup if missing**
- [ ] You can ping the agent from your phone, anywhere

If any are red, do not declare done. Cloud Run with a public unauthenticated cron endpoint is a liability.

## ➡️ Next Level

Your agent ships. Now make it production-grade. **[Level 5: Harden the Cloud →](../level_5/README.md)** — threat-model your deployed agent and wire nine concrete security gates that the daemon refuses to start without.

## 🎉 Congratulations

You walked in knowing how to call an LLM. You're walking out knowing how to **build, deploy, and operate an autonomous agent** — on the same Google Cloud stack used by production systems.

Next: read [`POST_WORKSHOP.md`](../POST_WORKSHOP.md) for graduation, certificate, extension projects, and how to keep your agent cheap (or kill it cleanly).

---

*From `console.log` to globally-reachable autonomous agent. Welcome to the future.* 🚀
