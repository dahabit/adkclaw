# Level 4 — Instructor Guide

**Audience**: Ahmed delivering live, AND any future MENA Dev team trainer who has been certified to teach AdkClaw.

This guide pairs with `level_4/codelab.md`. Read both before delivering. **L4 has the highest variance** of any level — Cloud APIs occasionally hiccup. Plan recovery scripts.

---

## 1. Cohort prep checklist (T-7 days, then day-of)

### T-7 days
- [ ] Confirm L3 was completed by all students (sub-agents + healing + cron working)
- [ ] Verify each student has a GCP project with billing enabled (the most common L4 blocker)
- [ ] Email students 48h before: enable APIs in advance (Cloud Run, Firestore, Secret Manager, Scheduler) — these can take 5–10 min to propagate
- [ ] Verify YOUR deploy works end-to-end on a fresh project — drift in `gcloud` defaults catches you out
- [ ] Pre-record the L4 backup demo video (15 min — full deploy + webhook + scheduler + custom domain)
- [ ] Have a backup project ready: if a student's billing is disabled mid-workshop, swap them onto your demo project for the rest of the level

### Day-of (T-30 min)
- [ ] Open `gcloud auth list` and `gcloud config list` — verify you're authenticated as the right account
- [ ] Pre-export `PROJECT_ID`, `REGION`, `SERVICE`, `BUCKET` in your shell — copy-paste-ready
- [ ] Have `Cloud Run` console tab open and ready to refresh
- [ ] Have `Logs Explorer` tab open with a saved query: `resource.type="cloud_run_revision"`
- [ ] Have a fresh Telegram bot ready (NOT the L1–L3 bot) so the webhook switch is clean
- [ ] Open `adkclaw.dev/e/<event>/fleet` — final pillar lights up here

---

## 2. Session run-of-show

L4 is the **deploy session.** ~2.5 hours total. Lots of `gcloud` commands; plan for variance.

| Block | Chapter | What you do |
|-------|---------|-------------|
| Re-intro (5 min) | none | "Three levels in, your agent is functional but tethered. Today we cut every tether." Recap the three architectural shifts. |
| Branch + verify (5 min) | Ch. 1 | `git checkout -b level-4`. Set `PROJECT_ID`, `REGION`, etc. Enable APIs (let them propagate while you talk). |
| Containerise (15 min) | Ch. 2 | Walk the multi-stage Dockerfile. Live-build + run locally. Curl `/api/health`. |
| Secret Manager (10 min) | Ch. 3 | Create the three secrets. Grant SA access. Explain why three not one. |
| Workspace to GCS (15 min) | Ch. 4 | Create bucket. `gcloud storage cp -r workspace/`. Walk the FUSE mount config. |
| Firestore adapter (20 min) | Ch. 5 | Live-write `firestore-store.ts`. `gcloud firestore databases create`. Walk the factory. |
| Deploy! (15 min) | Ch. 6 | The big `gcloud run deploy` command. Wait the 3–5 min. Smoke-test with curl. |
| Telegram webhook (10 min) | Ch. 7 | `setWebhook`. Test from phone. |
| Cloud Scheduler (15 min) | Ch. 8 | Create job. OIDC verification. Watch Logs Explorer for the trigger. |
| Cloud Logging (10 min) | Ch. 9 | Replace `console.log` with structured logger. Demo a log query. |
| Custom domain (15 min, optional) | Ch. 10 | `domain-mappings create`. Add DNS records. Wait for SSL. |
| Wow demo + Q&A (15 min) | Ch. 11 + close | Phone in hand: send a message. Throw the laptop in a metaphorical lake. |

If running short, **skip the custom domain** (Ch. 10) — it's optional and DNS propagation eats time. Don't skip Cloud Scheduler — it replaces `node-cron` and is a huge "aha".

---

## 3. Demo script — the L4 reveal

The cumulative effect: "your agent is a real product now."

### Setup
- Two terminal tabs: one for `gcloud`, one for `curl` testing
- Cloud Console tab open to Cloud Run service detail
- Logs Explorer tab open with the saved query
- Phone with Telegram open, fresh bot loaded
- The `set_env.sh` from L0 sourced

### Demo 1 — The "deploy wall"

> **Say:** "Watch what 'production' looks like."

Run the deploy command:

```bash
gcloud run deploy adkclaw --source=. --region=us-central1 ...
```

While Cloud Build runs (3–5 min):

> **Say:** "Cloud Build is reading the Dockerfile, building the image, pushing it to Artifact Registry, then deploying. We'll see logs streaming in a moment."

Show the Cloud Build logs in another tab so students see the multi-stage build progressing.

When it completes:

```bash
SERVICE_URL=$(gcloud run services describe adkclaw --region=us-central1 --format='value(status.url)')
curl $SERVICE_URL/api/health
# {"ok":true}
```

> **Say:** "Public HTTPS URL. Auto-provisioned SSL. No nginx, no certbot, no load balancer config. From `npm install` to global URL in five minutes."

### Demo 2 — "Hi from anywhere on Earth"

Set the Telegram webhook:

```bash
curl -F "url=$SERVICE_URL/api/telegram" \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
```

Pull out your phone. Send: `Hi from anywhere on Earth.`

Bot replies. Show the response.

> **Say:** "That message hit Cloud Run from my phone. Cloud Run scaled an instance up, ran the agent loop, called Gemini, replied. The next message will go to the SAME warm instance. After 15 minutes of idle, it scales to zero — I pay nothing while it's idle."

### Demo 3 — Cloud Scheduler triggers cron

```bash
gcloud scheduler jobs create http adkclaw-test \
  --schedule="*/2 * * * *" \
  --uri="$SERVICE_URL/api/cron/fire" \
  --http-method=POST \
  --location=us-central1 \
  --oidc-service-account-email="$SA" \
  --message-body='{"jobId":"test"}'
```

Wait ~2 minutes. In Logs Explorer, point to the inbound POST + the cron handler running.

> **Say:** "Cloud Scheduler fired an HTTPS request to my service. The OIDC token authenticates it as the scheduler service account. The handler ran the cron's action. If two schedulers fired at the same second, the idempotency-key UNIQUE constraint dedupes."

Delete the test job:

```bash
gcloud scheduler jobs delete adkclaw-test --location=us-central1 --quiet
```

### Demo 4 — Logs query

In Logs Explorer:

```
resource.type="cloud_run_revision" 
resource.labels.service_name="adkclaw"
severity=INFO
jsonPayload.toolName="web_search"
```

Show every `web_search` call in the last hour, queryable, with structured fields.

> **Say:** "Structured JSON logs, queryable in real time, exportable to BigQuery, free up to 50 GiB/month. Production observability comes for free with Cloud Run."

### Demo 5 — Custom domain (if Ch. 10 covered)

Show `https://agent.adkclaw.dev` resolving — same response as the `.run.app` URL.

> **Say:** "Branded URL, auto-SSL, takes about five minutes including DNS propagation. Hand this URL to a friend."

### If the live demo fails

- Switch to backup recording within 10 seconds
- Don't apologise. "Recorded earlier — same flow."
- Continue normally

L4 has the most ways to fail. The most common: a stale `gcloud auth` (run `gcloud auth login` again) or a slow Cloud Build (just wait).

---

## 4. Common pitfalls (what students hit)

### Pitfall 1: Billing not enabled
The most common L4 blocker. `gcloud services enable` returns "billing is required."

**Fix**: Console → Billing → Link a billing account. Or ask Ahmed for a workshop credit code.

### Pitfall 2: APIs not enabled / propagation delay
Student enables `run.googleapis.com` then runs `gcloud run deploy` immediately and gets 403.

**Fix**: wait 30 seconds and retry. Tell students to enable APIs the day before.

### Pitfall 3: `PORT=8080` not honoured
Student left `PORT=3000` hardcoded in `index.ts`. Cloud Run health check fails.

**Fix**: walk the boot path. `process.env.PORT ?? 8080`. Re-deploy.

### Pitfall 4: Dockerfile missing `--omit=dev` in deps stage
Image is 4 GB instead of 1 GB. Build is slow, deploy is slow.

**Fix**: re-check the Dockerfile. The deps stage uses `npm ci --omit=dev`.

### Pitfall 5: `--allow-unauthenticated` confusion
Student worried about exposing the dashboard.

**Fix**: explain the trade-off. Telegram webhooks can't sign requests, so the service must accept unauth POSTs. The endpoint validates the Telegram signature internally. The dashboard is a Phase 2 hardening item.

### Pitfall 6: Cloud Scheduler returns 401
OIDC service account missing `roles/run.invoker`.

**Fix**:
```bash
gcloud run services add-iam-policy-binding $SERVICE \
  --region=$REGION \
  --member="serviceAccount:$SA" \
  --role="roles/run.invoker"
```

### Pitfall 7: GCS FUSE shows stale files
Student writes to `workspace/bank/facts/X.md`, agent doesn't see it on next read.

**Fix**: GCS FUSE has eventual consistency. Add a 1s delay or in-process cache. Tell students this is a known trade-off — for the bank it's fine; for hot session state we use Firestore.

### Pitfall 8: Firestore quotas hit
Student spamming the agent during testing — 50K reads/day cap exceeded.

**Fix**: pagination on `messages` queries. Production code has `limit(20)` on session message reads. Walk the query.

### Pitfall 9: Telegram bot 401 on webhook
Student left the L1 bot's polling running locally — Telegram delivers to BOTH.

**Fix**: stop the local daemon. Telegram is one-webhook-per-bot.

### Pitfall 10: DNS records added but `agent.adkclaw.dev` doesn't resolve
Propagation delay — 5–60 minutes depending on registrar TTL.

**Fix**: check `dig agent.adkclaw.dev`. If it resolves to Google's IPs but SSL is "pending", wait. If DNS itself isn't there, re-check the registrar.

---

## 5. FAQ

### About containerisation
| Question | Answer |
|----------|--------|
| Why Playwright base instead of Node Alpine? | Playwright base ships browser deps. Saves 200 MB of build-time `apt-get`. |
| Can I shrink the image? | Yes — use `node:22-bookworm-slim` and skip browser tools. But you lose `browser_*` tools. |
| Multi-stage worth it? | Yes — final image is 1 GB instead of 2.5 GB. Faster pulls, faster cold starts. |

### About Cloud Run
| Question | Answer |
|----------|--------|
| Why scale to zero by default? | Free tier covers it. Set `--min-instances=1` ($15/mo) only if cold starts hurt UX. |
| What about persistent connections (WebSockets)? | Cloud Run gen2 supports them up to 60 min. Telegram doesn't need WS — webhook is an HTTPS POST. |
| Can I run multiple regions? | Yes — deploy to two regions, use Cloud Load Balancer for geo-routing. Phase 2. |

### About Firestore vs SQLite
| Question | Answer |
|----------|--------|
| Why migrate sessions but not the bank? | Sessions need indexed queries. The bank needs grep. Different tools. |
| Can I keep SQLite in Cloud Run? | No — instances are ephemeral. Volume-mount Cloud Storage for SQLite is possible but slow. |
| What's the read cost for chat history? | One read per turn (the message list), one write per message. ~30 reads + 30 writes per active hour — comfortably free. |

### About Cloud Scheduler vs node-cron
| Question | Answer |
|----------|--------|
| Why not run `node-cron` on Cloud Run? | Cloud Run scales to zero. There's no process running cron. |
| What about retries? | Cloud Scheduler retries 3x by default on 5xx. node-cron doesn't retry. |
| Cost? | First 3 jobs are free. Past that: $0.10/job/month. |

### About logs
| Question | Answer |
|----------|--------|
| How do I export logs to BigQuery? | Logs Router → create a sink → destination BigQuery. Free for the first 50 GiB. |
| How do I alert on errors? | Cloud Monitoring → log-based metric → alerting policy. Free for the first metric. |
| Can I scrub PII? | Yes — middleware that redacts emails/phone numbers before `console.log`. Phase 2 hardening. |

### About custom domains
| Question | Answer |
|----------|--------|
| Can I use Apex (no subdomain)? | Yes — `apex.adkclaw.dev` style. Set both `A` records and `CAA` per docs. |
| What about Cloudflare in front? | Works — set `CNAME` to `ghs.googlehosted.com`. Cloudflare orange-cloud must be off for SSL provisioning. |
| Cost? | DNS is your registrar's cost. Cloud Run domain mapping is free. |

---

## 6. Recovery scripts — when things break live

### Cloud Build hangs
```bash
gcloud builds list --limit=5
gcloud builds cancel <BUILD_ID>
# Re-run with --verbosity=debug
gcloud run deploy ... --verbosity=debug
```

### Half the cohort can't enable APIs
Quotas exhausted on the org. Have a backup project ready and a "use my project" credentials JSON.

### Telegram silently delivers nothing
Three checks in order:
1. `curl -F "url=$SERVICE_URL/api/telegram" .../setWebhook` → re-register
2. `curl https://api.telegram.org/bot$TOKEN/getWebhookInfo` → confirm pending_update_count, last_error_message
3. Cloud Run logs → look for incoming POSTs to `/api/telegram`

### A student's deploy fails: "Image too large"
Cache miss in their region. Tell them to switch to `us-central1` (always cached) and redeploy.

### Cloud Scheduler returns 403 for everyone
Service account missing run.invoker:
```bash
gcloud run services add-iam-policy-binding adkclaw \
  --region=us-central1 \
  --member="serviceAccount:$SA" \
  --role="roles/run.invoker"
```

### "I don't have a domain"
Skip Ch. 10 entirely. The `.run.app` URL works fine. They can add a domain later.

---

## 7. Timing notes (real-world pacing)

| Block | Planned | Cohort 1 actual range | Adjust |
|-------|---------|----------------------|--------|
| Re-intro | 5 min | 3–8 min | Cap at 8 |
| Branch + verify | 5 min | 5–15 min | API enable propagation eats time — let students enable while you teach |
| Containerise | 15 min | 12–25 min | First-time Docker users go slow |
| Secret Manager | 10 min | 8–15 min | The IAM grant has the most variance |
| Workspace to GCS | 15 min | 12–20 min | FUSE mount syntax confuses people |
| Firestore adapter | 20 min | 18–35 min | The biggest variance — adapter pattern is new for most |
| Deploy | 15 min | 12–25 min | Cloud Build duration is non-deterministic |
| Telegram webhook | 10 min | 8–15 min | One bash command — usually quick |
| Cloud Scheduler | 15 min | 12–20 min | OIDC explanation takes time |
| Cloud Logging | 10 min | 8–15 min | Logger refactor is mechanical |
| Custom domain | 15 min (opt) | DNS propagation variable | **Skip if behind** |
| Wow demos | 15 min | 12–25 min | The "anywhere on Earth" moment is the highlight |

If you're 30+ min behind by Ch. 6 (deploy), **skip Ch. 10 (custom domain) and shorten Ch. 9 (logging) to 5 min**. The deploy + webhook + scheduler trio is the load-bearing ending.

---

## 8. Train-the-trainer notes

### Load-bearing concepts (do not skip)
1. **Cloud Run scales to zero, so cron must be external** — this drives the entire architecture
2. **Adapter pattern lets you swap backends** — same interface, different storage
3. **Secrets are mounted as env vars** — never bake into the image
4. **OIDC is how machine identities authenticate** — no shared secrets, no rotation pain

### Concepts that can be summarised
- Multi-stage Dockerfile rationale (~30 sec — image size + cache layers)
- Why Firestore for sessions but Cloud Storage for bank (~30 sec — query patterns)
- Why structured JSON logs (~30 sec — Cloud Logging indexes JSON)

### Concepts that always run long
- The Firestore adapter (Ch. 5) — students keep wanting to add features. Cap to interface-parity.
- Cloud Scheduler OIDC (Ch. 8) — the JWT verification middleware confuses people on first read.
- DNS records (Ch. 10) — every registrar's UI is different.

### What you absolutely must NOT do
- Skip the deploy. Even if you ran out of time, do `gcloud run deploy --source=.` and let them watch the build.
- Use a real production API key during the demo — use a key isolated to the workshop project.
- Forget to set `--max-instances=3`. A runaway agent could spike Cloud Run costs fast.
- Show "use Heroku/Vercel/Render" as alternatives mid-build — they're great products, but they're not Google's stack and dilute the codelab.

### How to certify

You are ready to teach Level 4 when you can:
1. Run the full deploy from `git checkout -b level-4` to live URL in 25 minutes
2. Recover from at least three of the common failure modes without notes
3. Run `gcloud auth login` correctly when authentication drifts mid-demo
4. Explain the Cloud Run cold-start trade-off ($15/mo for warm instance) in one breath

Ahmed certifies via a 90-minute mock-teach over Zoom — you teach Level 4 to him, he plays a confused student with a flaky GCP project.

---

## Where to update this guide after each cohort

After each cohort:
- [ ] Add new pitfalls to Section 4
- [ ] Add new questions to FAQ if asked >1 time
- [ ] Update timing variance numbers (L4 has the most variance)
- [ ] Note slides that landed flat or great in `level_4/INSTRUCTOR-LOG.md`
- [ ] Track which Cloud APIs hiccupped so you can warn future cohorts
