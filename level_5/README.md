# Level 5: Harden the Cloud

**Take your deployed agent from "shipped" to "production-grade." Nine concrete security gates, every one wired into code that refuses to start without them.**

You finished Level 4. Your agent is on Cloud Run, reachable from Telegram, persisting in Firestore. It works. But it's also one misconfigured route away from leaking your session history, one buggy sub-agent loop away from a $400 bill, one stale token away from someone else owning your bot. Production-grade means none of those are theoretical.

In this level you implement the security gates the codelab has been calling "mandatory" — and you make the daemon refuse to start when any of them is missing. Hardening isn't optional politeness; it's structural enforcement.

## 🎯 What You'll Learn

| Concept | Description |
|---------|-------------|
| **Threat modeling** | Identify what can go wrong before you write defenses for it |
| **Auth at the edge** | Why every public route needs a verifier, including the dashboard |
| **OIDC for Cloud Scheduler** | How Google's tokens prove a request came from your scheduler, not the public internet |
| **FATAL-on-missing config** | Make the daemon refuse to start without budget caps, allowlists, and admin keys |
| **PII redaction with Cloud DLP** | Replace regex with a real classifier — emails, phones, addresses, names |
| **Firestore security rules** | Default-deny rules tested against the emulator |
| **Secret rotation** | Run a leak drill: generate, deploy, verify, revoke — without downtime |
| **Supply-chain hardening** | `npm audit`, container scan, lockfile discipline |
| **Audit + anomaly alerts** | Token-spike + cost-spike detection wired into Cloud Monitoring |

## ✅ What You'll Build

By the end of this level, you will have:

- 🛡️ A `THREAT_MODEL.md` checked into your repo
- 🔐 An admin-auth middleware on `/` and `/api/admin/*` that returns 401 to anyone without `x-admin-key`
- 🪝 A real `/api/cron/fire` route with OIDC verification that rejects every request without a Google-signed token
- 💸 A `BudgetGuard` that refuses to start without an explicit `DAILY_TOKEN_BUDGET`
- 🧹 A Cloud DLP-backed log redactor (replacing the regex)
- 🔥 Default-deny Firestore rules + emulator tests proving them
- 🔄 A completed secret-rotation drill (Gemini key, Telegram token, webhook secret)
- 📋 An `npm audit` clean tree + container scan
- 📊 Cloud Monitoring alert policies for token + cost spikes

This is the **🛡️ Hardened pillar** — the final badge after Brain · Memory · Army · Cloud.

## 📋 Prerequisites

- ✅ Level 4 complete — agent deployed on Cloud Run, Firestore-backed, custom domain optional
- ✅ Service account + IAM bindings already provisioned (you set them up in L4)
- ✅ `gcloud` CLI authenticated, project + region exported
- ✅ A *separate* tab open with the Cloud Run logs streaming — you'll watch errors land in real time

## 🚀 Quick Start

```bash
cd codelab/starter
git checkout v4-complete -- .       # if you want a clean L4 baseline to harden
git checkout -b harden               # new branch — security changes deserve isolation

# Read the threat-model template first; you'll fill it as you go
cat ../../level_5/THREAT_MODEL.template.md

# Follow the codelab section by section
```

## 🛡️ The Hardening Pyramid

```
┌─────────────────────────────────────┐
│  9. Audit + anomaly alerts          │ <- Detect what slipped through
├─────────────────────────────────────┤
│  8. Supply-chain (npm + container)  │ <- Trust your dependencies
├─────────────────────────────────────┤
│  7. Secret rotation drill           │ <- Be ready to react
├─────────────────────────────────────┤
│  6. Firestore security rules        │ <- Default-deny at the data layer
├─────────────────────────────────────┤
│  5. Cloud DLP for PII               │ <- Never log what you'll regret
├─────────────────────────────────────┤
│  4. BudgetGuard FATAL               │ <- Bound the blast radius
├─────────────────────────────────────┤
│  3. OIDC on /api/cron/fire          │ <- Prove who called you
├─────────────────────────────────────┤
│  2. Admin auth on /                 │ <- No public eyes on internal state
├─────────────────────────────────────┤
│  1. Threat model                    │ <- Know what you're defending against
└─────────────────────────────────────┘
```

The bottom is foundational; the top is operational. Build up, top down.

## 📖 Full Codelab

For the step-by-step implementation:

**[📚 Level 5 Codelab →](codelab.md)**

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Daemon won't start: `FATAL: ADMIN_KEY is required` | Generate one: `openssl rand -hex 32 \| gcloud secrets create admin-key --data-file=-`. Wire it into Cloud Run's `--update-secrets`. |
| `curl /api/cron/fire` returns 200 to anonymous request | OIDC middleware not wired. Check `src/server/index.ts` — `verifyOidc` must precede the route handler. |
| Firestore rules refuse legit reads | Service account didn't get `roles/datastore.user`. Grant it: `gcloud projects add-iam-policy-binding ...`. |
| Cloud DLP returns 403 on first call | DLP API not enabled. Run `gcloud services enable dlp.googleapis.com`. |
| `npm audit` lists transitive vuln you can't fix | Pin via `overrides` in `package.json` — yarn-resolutions equivalent. Document in `THREAT_MODEL.md` if you have to accept it. |
| Cron Scheduler call returns 401 with valid OIDC | Audience mismatch: must equal your Cloud Run service URL exactly. Re-create the job with `--oidc-token-audience=$SERVICE_URL`. |

## 🏁 Workshop complete when…

- [ ] `THREAT_MODEL.md` committed (each row: threat → control → status)
- [ ] Anonymous `curl $SERVICE_URL/` returns **401**
- [ ] Anonymous `curl -X POST $SERVICE_URL/api/cron/fire` returns **401**
- [ ] Daemon refuses to start with any of these missing: `ADMIN_KEY`, `DAILY_TOKEN_BUDGET`, `ALLOWED_SENDERS`, `TELEGRAM_WEBHOOK_SECRET`, `OIDC_AUDIENCE`, `OIDC_SERVICE_ACCOUNT`
- [ ] Cloud DLP redacts a sample log line containing `name@email.com` to `[email]`
- [ ] Firestore emulator tests pass: `npm test src/storage/firestore-rules.test.ts`
- [ ] Secret-rotation drill completed: old Gemini key returns 401, new key works
- [ ] `npm audit --production` returns 0 vulnerabilities (or documented exceptions)
- [ ] Cloud Monitoring alert policy fires when token spend exceeds 2× daily average

## 🎉 You're production-ready

A chatbot answers. An agent acts. A **hardened agent** acts and refuses to act badly. Yours is the third one.

The stretch projects in `extensions/` (Slack, RAG, Voice, MCP) all build on this hardened base — the gates you wired here protect every channel you add.

---

*From shipped to production. The fifth pillar lights up.* 🛡️
