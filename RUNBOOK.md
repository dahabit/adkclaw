# RUNBOOK — operating your AdkClaw agent in production

This runbook is for **graduates of Level 4** — you've deployed your own agent
to Cloud Run in your own GCP project and want to keep it healthy. It is **not**
documentation for running `adkclaw.dev` (that lives in the private
adkclaw-platform repo).

Three rules before you touch anything in production:

1. **Read the logs first** — `gcloud run services logs read $SERVICE --region=$REGION --limit=200` answers most of these.
2. **Don't disable security gates** — the startup gates (DAILY_TOKEN_BUDGET, ADMIN_KEY, ALLOWED_SENDERS, OIDC_AUDIENCE/OIDC_SERVICE_ACCOUNT, TELEGRAM_WEBHOOK_SECRET) exist for reasons that surfaced as incidents in prior cohorts. If one is firing, set it; don't comment it out.
3. **Rollback is faster than fixing forward** — Cloud Run keeps the previous revision warm. `gcloud run services update-traffic` is one command and zero data loss for read-only paths.

---

## Common operations

### Redeploy from local source

```bash
cd level_4/starter    # or your own working tree
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT/agents/adkclaw
gcloud run deploy $SERVICE \
  --image $REGION-docker.pkg.dev/$PROJECT/agents/adkclaw \
  --region $REGION
```

The build runs `npm ci && npm run build` inside the Dockerfile. If `npm run build` is red, the deploy aborts before any traffic shifts.

### Rotate a secret (admin key, webhook secret, Gemini key)

Secrets are versioned. Add a new version, then update the Cloud Run service to read the latest:

```bash
NEW=$(openssl rand -hex 32)
echo -n "$NEW" | gcloud secrets versions add admin-key --data-file=-
gcloud run services update $SERVICE --region $REGION \
  --update-secrets=ADMIN_KEY=admin-key:latest
# Cloud Run rolls in a new revision; old one stays up until traffic shifts.
```

`Gemini API key` and `Telegram webhook secret` follow the same pattern — change the secret name.

For the **Telegram webhook secret**, you must also re-register the webhook so Telegram knows the new value:

```bash
curl -F "url=$SERVICE_URL/api/telegram" \
     -F "secret_token=$NEW" \
     https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
```

### Rollback to the previous revision

```bash
PREV=$(gcloud run revisions list --service $SERVICE --region $REGION \
       --format="value(name)" --limit=2 | tail -1)
gcloud run services update-traffic $SERVICE --region $REGION \
  --to-revisions=$PREV=100
```

Cloud Run revisions are immutable; the rollback is instant. Investigate the broken revision afterward — don't delete it until you understand why it failed.

### Dump the current session table (Firestore)

```bash
# All non-archived sessions, ordered by last touch:
gcloud firestore export gs://$PROJECT-firestore-backups/$(date -u +%Y%m%dT%H%M%SZ) \
  --collection-ids=sessions
```

For ad-hoc inspection in your editor:

```bash
gcloud firestore documents list sessions --limit=20
```

### Tail structured logs (Cloud Logging)

```bash
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" \
  --format='value(timestamp,jsonPayload.event,jsonPayload.toolName,severity,textPayload)'
```

The agent emits one JSON log line per turn (`event=turn_complete`) and one per tool call (`event=tool_call`). `severity=ERROR` rows are worth investigating; `WARNING` rows usually self-recover via HealingEngine.

### Pause cron (without redeploying)

```bash
for j in $(gcloud scheduler jobs list --location $REGION --format='value(name)' | grep adkclaw); do
  gcloud scheduler jobs pause "$j" --location $REGION
done
```

Resume with `gcloud scheduler jobs resume`.

---

## Incident response

### Agent stopped replying on Telegram

In order — stop at the first symptom that explains the silence.

1. Open the Cloud Run logs (above). Recent `severity=ERROR`?
2. `gcloud run services describe $SERVICE --region $REGION --format='value(status.url)'` — does the URL respond to `curl $URL/api/health`? If 401, OIDC misconfigured; if 503, the daemon crashed at startup (check logs for an `assert*` throw).
3. `curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo` — is the webhook URL still pointing at your service? Is `pending_update_count` rising? Are there recent `last_error_message` values?
4. If the webhook URL is wrong (e.g. you redeployed under a new revision URL), re-register: see "Rotate a secret" above, same `setWebhook` call.

### Cost spike alert

If your Cloud Billing alert fires, the cause is almost always one of:

- **Sub-agent runaway** — a parent agent spawned a sub-agent that spawned another, and the chain didn't hit the per-profile `maxToolRounds`. Check `severity=WARNING` logs filtered to `event=spawn_loop_warning`.
- **Cron misfire** — Cloud Scheduler is hitting `/api/cron/fire` more often than its schedule (network retries on 5xx). Look at `cron_runs` Firestore collection for duplicate `idempotency_key` rows; if you see them, the engine's dedupe is working — the *cost* is from Gemini calls inside the duplicated fire. Throttle the scheduler retry policy.
- **DAILY_TOKEN_BUDGET set too high** — the gate is a budget, not a cap. If a sender hits the budget, `BudgetGuard.check()` refuses the turn. If you set the budget to 1M and the agent does 900K of work for one user, that's still 900K of work.

**Mitigation:** rotate `GEMINI_API_KEY` to a quota-capped key while you investigate. The agent will refuse all turns until you set the new one — preferable to runaway charges.

### Firestore reads spiking

A Firestore-backed deploy reads on every turn (the prefetch buffer). Pagination + the `limit(200)` in `FirestoreSessionStore.loadSession` keep this bounded. If you see >5 reads/turn:

- Inspect `severity=INFO` logs filtered to `event=session_load`. Are you opening sessions you don't need (e.g., loading parent + child + child of child for every spawn)?
- The cure is to **not load the parent session inside a spawn** — sub-agents have isolated history (rule 2 in L3). If you see `parent_key` loads, the orchestrator is leaking.

### Dashboard returns 401 unexpectedly

The `/api/admin/*` middleware requires `Authorization: Bearer $ADMIN_KEY`. If you rotated `ADMIN_KEY` and the dashboard now 401s:

- The new revision rolled in but your browser still has the old key in localStorage. Open the admin URL in a private window and paste the new key.
- Or check `gcloud run services describe $SERVICE --format='value(spec.template.spec.containers[0].env[?(@.name=="ADMIN_KEY")])'` — Cloud Run shows the secret reference; if `:latest` didn't pick up the new version, re-deploy.

---

## When in doubt

- **Don't comment out a gate to "see if it works"** — the gate will be quieter than the bug it catches.
- **Don't `gcloud run services delete`** — you lose the URL and have to re-register the Telegram webhook. Just disable traffic with `--to-revisions=$NONE=0` if you need to stop serving.
- Ask in the cohort channel before doing anything destructive in production. The instructor has seen this incident before.
