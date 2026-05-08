# Level 4 — Resources

Curated links + ideas for students AND instructors. Same template as L3.

---

## Reference docs

### Cloud Run
- [Cloud Run docs — gen2 services](https://cloud.google.com/run/docs/about-instance-autoscaling) — autoscaling, concurrency, cold starts
- [Cloud Run pricing](https://cloud.google.com/run/pricing) — free tier + per-millisecond billing
- [Cloud Run + GCS FUSE](https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts) — the workspace mount we use
- [Container contract](https://cloud.google.com/run/docs/container-contract) — `PORT`, `/api/health`, signal handling

### Cloud Build
- [`--source=.` behaviour](https://cloud.google.com/run/docs/deploying-source-code) — what happens behind that flag
- [`cloudbuild.yaml` reference](https://cloud.google.com/build/docs/build-config-file-schema) — automated multi-step builds
- [Caching strategies](https://cloud.google.com/build/docs/optimize-builds/speeding-up-builds) — speed up your builds

### Secret Manager
- [Secret Manager quickstart](https://cloud.google.com/secret-manager/docs/quickstart) — create, version, access
- [IAM for secrets](https://cloud.google.com/secret-manager/docs/access-control) — grant `secretAccessor` to the SA
- [Mounting secrets in Cloud Run](https://cloud.google.com/run/docs/configuring/secrets) — env-var vs file mount

### Firestore
- [Firestore data model](https://firebase.google.com/docs/firestore/data-model) — collections + documents
- [Firestore Node SDK](https://www.npmjs.com/package/@google-cloud/firestore) — what we use
- [Firestore best practices](https://cloud.google.com/firestore/docs/best-practices) — index design, write batching
- [Firestore emulator](https://cloud.google.com/firestore/docs/emulator) — for local tests

### Cloud Storage
- [Storage quickstart](https://cloud.google.com/storage/docs/quickstart-gcloud) — bucket creation
- [GCS FUSE](https://cloud.google.com/storage/docs/cloud-storage-fuse) — mounting buckets as filesystems
- [Strong consistency rules](https://cloud.google.com/storage/docs/consistency) — what GCS guarantees

### Cloud Scheduler
- [Cloud Scheduler quickstart](https://cloud.google.com/scheduler/docs/quickstart) — create HTTP jobs
- [OIDC auth for Cloud Run](https://cloud.google.com/scheduler/docs/http-target-auth) — the JWT we verify
- [Cron syntax](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules) — slightly different from `node-cron`

### Cloud Logging
- [Structured logs](https://cloud.google.com/logging/docs/structured-logging) — JSON to stdout
- [Logs Explorer queries](https://cloud.google.com/logging/docs/view/logging-query-language) — LQL reference
- [Log-based metrics](https://cloud.google.com/logging/docs/logs-based-metrics) — alerting on patterns

### Custom domains
- [Cloud Run domain mappings](https://cloud.google.com/run/docs/mapping-custom-domains) — A/AAAA records
- [SSL/TLS certificate provisioning](https://cloud.google.com/run/docs/mapping-custom-domains#dns_update) — auto-managed

### Telegram webhook mode
- [Telegram bot webhooks](https://core.telegram.org/bots/webhooks) — official guide
- [`setWebhook` API](https://core.telegram.org/bots/api#setwebhook) — full options
- [`getWebhookInfo`](https://core.telegram.org/bots/api#getwebhookinfo) — debugging

---

## Sister codelabs from Google

| For our pillar | Google codelab | Why |
|----------------|----------------|-----|
| Cloud Run | [Run a Node.js app on Cloud Run](https://codelabs.developers.google.com/codelabs/cloud-run-deploy) | Same deploy flow |
| Firestore | [Build a Firestore-backed Cloud Run service](https://codelabs.developers.google.com/codelabs/cloud-run-firestore) | Adapter pattern in Python |
| Secret Manager | [Use Secret Manager with Cloud Run](https://codelabs.developers.google.com/codelabs/cloud-run-secrets) | Same `--set-secrets` flow |
| Cloud Scheduler | [Triggering Cloud Run with Cloud Scheduler](https://codelabs.developers.google.com/codelabs/cloud-run-scheduler) | OIDC auth pattern |
| Multi-region | [Cloud Run + Cloud Load Balancer](https://codelabs.developers.google.com/cloud-run-multi-region) | Phase 2 stretch |

---

## Sample prompts to demo (test your agent with these)

### After Chapter 6 (Deploy)
```bash
curl $SERVICE_URL/api/health
curl -X POST $SERVICE_URL/api/chat -H 'content-type: application/json' \
  -d '{"sessionKey":"test","message":"Hello"}'
```

### After Chapter 7 (Telegram webhook)
```
[on phone] Hi from anywhere on Earth!
[on phone] Are you running locally or in the cloud?
[on phone] What region are you in?
```

### After Chapter 8 (Cloud Scheduler)
```bash
gcloud scheduler jobs run adkclaw-test --location=$REGION
gcloud logging read 'resource.type="cloud_run_revision" jsonPayload.cron_job_id="test"' --limit=3
```

### Stress-test prompts
```
[10 simultaneous chats from 10 phones] Hi.
                  (tests --concurrency=10 cap)

[While idle for 20 min] Hi.
                  (tests cold start latency)

[Force a 5xx via web_fetch on a deliberately broken URL]
                  (tests the cloud logging error capture)
```

---

## Inspiration — articles, talks, tweets

### On serverless agent architecture
- [Anthropic — Building production-ready agents](https://www.anthropic.com/research) — production patterns
- [Cloud Run for AI workloads](https://cloud.google.com/blog/products/ai-machine-learning) — why scale-to-zero suits agent traffic
- [Adam Riggs-Zeigen — "Why we moved from Heroku to Cloud Run"](https://cloud.google.com/customers) — migration economics

### On observability
- [Google SRE Workbook — Monitoring](https://sre.google/workbook/monitoring/) — what to alert on
- [Charity Majors — High-cardinality observability](https://charity.wtf/) — why structured logs > stack traces

### On cost optimisation
- [Cloud Run pricing calculator](https://cloud.google.com/products/calculator/) — model your usage
- [Free tier reference](https://cloud.google.com/free) — what stays free at small scale
- [Mark Edmondson — "Cloud Run Always Free"](https://code.markedmondson.me/) — practitioner write-ups

---

## Deep dives — for students who want to go beyond Level 4

### After Chapter 2 (Containerisation)
- Read `Dockerfile` and the GitHub Actions workflow that builds + deploys on push
- Compare with [Distroless Node images](https://github.com/GoogleContainerTools/distroless) — security/size trade-offs
- Look at how Playwright base contributes ~700 MB; consider alternatives if `browser_*` tools aren't needed

### After Chapter 5 (Firestore adapter)
- Read the production `FirestoreSessionStore` — uses Firestore's listener API for cron persistence
- Look at the migration script `scripts/migrate-sqlite-to-firestore.ts` for one-off imports
- Read [Firestore best practices](https://cloud.google.com/firestore/docs/best-practices) on hot keys and write contention

### After Chapter 6 (Deploy)
- Read [`cloudbuild.yaml`](https://github.com/dahabit/adkclaw/blob/main/cloudbuild.yaml) — automated builds on git push
- Walk through Artifact Registry to see your image versions
- Look at Cloud Run revisions — every deploy is a new revision; you can roll back instantly

### After Chapter 8 (Cloud Scheduler)
- Read the OIDC verification middleware — JWT validation against Google's certs
- Compare with Cloud Tasks — pull-based work queues for longer jobs
- Look at Pub/Sub triggers as an alternative for cross-service events

### After Chapter 10 (Custom domain)
- Read about [Identity-Aware Proxy](https://cloud.google.com/iap) for putting auth in front of your Cloud Run service
- Look at Cloud Armor for DDoS protection at the edge
- Consider Cloud CDN for caching static assets

---

## "If a student asks X..."

Quick reference for instructors during Q&A.

| Question | Point them to | One-liner |
|----------|---------------|-----------|
| "Should I use AWS Lambda instead?" | Cloud Run vs Lambda comparison | "Cloud Run gives you containers + 15min request timeout; Lambda is faster cold start but has 10MB image limit. Containers are more flexible." |
| "What about Vercel / Render?" | Multi-cloud thinking | "Both are great. Cloud Run is what we teach because the curriculum is Google-stack — same patterns work on those." |
| "How do I run the agent without Telegram?" | HTTP-only mode | "Don't set `TELEGRAM_BOT_TOKEN`. The HTTP `/api/chat` endpoint works alone." |
| "Can I use Cloud SQL instead of Firestore?" | Adapter pattern | "Yes — implement `SessionStore` for postgres. Add `SESSION_BACKEND=postgres`. ~200 LOC, same shape." |
| "How do I deploy from CI?" | GitHub Actions + Workload Identity Federation | "Set up WIF, no service-account JSON keys. Build + deploy on push. Phase 2 stretch." |
| "What about Vertex AI Agent Builder for production?" | Vertex AI Agents | "Great for workflows. AdkClaw teaches the underlying pattern. You can migrate to Agent Builder once your shape is stable." |
| "Costs at scale?" | Cloud Run + Gemini calculator | "Infra cost is negligible per request. Gemini Pro is the dominant variable cost — route sub-agents to Flash." |
| "Can I serve from multiple regions?" | Cloud Load Balancer | "Yes — deploy to two regions, put a global LB in front. Phase 2." |
| "What's the cold-start time?" | Cloud Run gen2 | "~2–3 seconds for our 1 GB image. Set `--min-instances=1` to keep it warm (note: warm instances bill continuously)." |
| "Can I run multiple agents from one service?" | Multi-tenant routing | "Yes — namespace by `senderId` in `SessionStore`. Phase 4 multi-tenant feature in roadmap." |
| "Is HTTPS automatic?" | Cloud Run TLS | "Yes — `.run.app` and custom domains both auto-provision SSL via Google's CA." |
| "Where does Logs Explorer keep my logs?" | Cloud Logging retention | "30 days free retention. Export to BigQuery for longer." |

---

## Cohort fleet view

After completing L4, students light up the **fourth (final) pillar** on the fleet:
**[adkclaw.dev/e/<event>/fleet](https://adkclaw.dev/e/sandbox/fleet)**

The L4 badge unlocks when the agent's `mark_level_complete` call carries `level: 4` + `region` + `publicAgentUrl`. The platform pings the `publicAgentUrl/api/health` to verify it's live, then displays it on the student's profile at `adkclaw.dev/u/<username>` for sharing.

This is the final pillar. Students who finish all four are on the leaderboard.

---

## Privacy + ethics notes for instructors

- Cloud Run logs are private to the GCP project, but Cloud Logging is **searchable**. Tell students to scrub PII (emails, phone numbers, free-text addresses) from logged messages.
- The `--allow-unauthenticated` flag exposes EVERY route, including `/api/admin`. Phase 2 hardening: add IAP or app-level auth.
- Firestore reads + writes incur quota and cost. A spammy user can rack up bills. Tell students to add per-`senderId` rate limiting.
- The Telegram webhook receives raw user messages over the public internet. Telegram authenticates with a webhook secret; verify it.
- Custom-domain SSL certs are auto-provisioned by Google. They expire on rotation. If a student's site goes 502 in 90 days, that's why — the domain was deleted but the cert wasn't rotated.

---

## Where to put feedback

- Open an issue: [github.com/dahabit/adkclaw/issues](https://github.com/dahabit/adkclaw/issues) with the label `level-4`
- Or DM Ahmed: [@dahabdev on X](https://x.com/dahabdev)
