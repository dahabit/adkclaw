# Threat Model — AdkClaw

Copy this template to `THREAT_MODEL.md` at your repo root and fill it in as you complete Level 5.

**Status legend:**
- **DEFENDED** — control is wired in code and tested
- **MITIGATED** — partial defense; risk reduced but not eliminated. Document the residual.
- **ACCEPTED** — known risk, business reason to accept, owner + date when revisited
- **OPEN** — not yet defended. Plan + deadline.

| # | Threat | Likelihood | Impact | Control | Status | Date / Owner |
|---|---|---|---|---|---|---|
| 1 | Gemini API key leaks via committed `.env` | High | High | `.gitignore` blocks `.env` and `set_env.sh`; pre-commit hook scans for key patterns | DEFENDED | |
| 2 | Anyone POSTs to `/api/cron/fire` and runs your jobs | Medium | High | `verifyOidc` middleware + FATAL on missing `OIDC_AUDIENCE` / `OIDC_SERVICE_ACCOUNT` | | |
| 3 | Buggy spawn loop runs up $400 in Gemini calls | Medium | High | `BudgetGuard` FATAL on missing `DAILY_TOKEN_BUDGET` + Cloud Billing alert at 50/90/100% | | |
| 4 | Telegram bot token leaks via bash history | Low | High | Use `gcloud secrets create --data-file=-` (heredoc), never echo, `unset` after | DEFENDED | |
| 5 | PII (emails, phones, names) lands in Cloud Logging | Medium | Medium | Cloud DLP `redactPii` middleware on logger; `LOG_REDACT=true` in production | | |
| 6 | Anyone reads Firestore via the public client SDK | Low | High | Default-deny `firestore.rules` + emulator tests + least-priv runtime SA | | |
| 7 | Stale Telegram webhook secret remains valid forever | Low | Medium | 90-day rotation cadence + `RUNBOOK.md` documented procedure | | |
| 8 | Compromised npm dep ships in your container | Low | Critical | `npm audit --production` in CI + lockfile + Artifact Registry container scan | | |
| 9 | Cron job fires every minute due to bug, drains budget | Low | High | `BudgetGuard` per-day cap + Cloud Monitoring alert on 2× spike | | |
| 10 | Sub-agent spawn loop bypasses tool allowlist | Low | High | L3 isolation rules (`profile.toolAllowlist` enforced in runner) + `audit:security` regression test | | |
| 11 | Admin dashboard at `/` exposes session keys to the public internet | High | High | `adminAuth` middleware + FATAL on missing `ADMIN_KEY` | | |
| 12 | Service account is over-privileged (Editor or Owner role) | High | Critical | Least-privilege rebind to `datastore.user` + `secretmanager.secretAccessor` + `dlp.user` + `logging.logWriter` only | | |

## Add your own rows

When you ship a new feature, add a row. Examples that come up often:

| # | Threat | Likelihood | Impact | Control | Status |
|---|---|---|---|---|---|
| 13 | Slack adapter (extension) — bot token leak via env-dump in logs | | | | |
| 14 | RAG corpus contains documents the user didn't intend to expose | | | | |
| 15 | Voice channel session audio is logged in cleartext | | | | |
| 16 | Webhook receives crafted update from a forged Telegram server | | | | |

## Review schedule

- **Quarterly**: walk every row, confirm controls still apply, re-test sample (curl 401 probes, secret rotation drill, npm audit)
- **On feature**: add a row before shipping, mark control before going live
- **On incident**: post-mortem updates the row, may add new rows

This document is a living artifact. If it's never updated, it's not threat-modeling — it's compliance theatre.
