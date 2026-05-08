# Pre-Workshop Prep — 7-Day Guide

You're booked into AdkClaw. Day 1 is going to move fast — the goal of this prep guide is to get your accounts, tools, and environment green well before the first session so we can start building the moment we hit "go."

Total time across the week: ~30 minutes if you're new to Google Cloud, ~10 minutes if you already have a project + Node 22.

## What you'll have when you're done

- ✅ A Google Cloud project with billing enabled (free tier is plenty)
- ✅ A Gemini API key
- ✅ A Telegram bot you control
- ✅ Node.js 22+ installed (or Cloud Shell ready)
- ✅ The repo cloned, dependencies installed
- ✅ All seven preflight checks passing

If `./scripts/preflight.sh` ends with `✅ All checks passed!` you are ready for Day 1.

## Day −7 → Day 0 — what to do, when

### Day −7 — accounts (10 minutes)

1. **Google Cloud project**
   - Sign in / create an account at [console.cloud.google.com](https://console.cloud.google.com).
   - Create a project (or reuse an existing one). Note the **project ID** — you'll use it everywhere.
   - Enable billing on the project — required to call Gemini, even though the workshop fits inside the free tier. Step-by-step: [console.cloud.google.com/billing](https://console.cloud.google.com/billing).
   - First-time users get $300 in free credits.

2. **Gemini API key**
   - Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   - Click **Create API key** and pick the project you just created.
   - Copy the key somewhere safe (you'll paste it into `.env` on Day 0). Treat it like a password.

3. **Telegram bot**
   - On Telegram, open [@BotFather](https://t.me/BotFather).
   - Send `/newbot`. Pick a name and a username ending in `bot` (e.g. `my_adkclaw_bot`).
   - BotFather replies with a token like `1234567:ABC...`. Copy it — that's your `TELEGRAM_BOT_TOKEN`.
   - Send `/setname` and `/setdescription` later if you want to personalize the bot.

4. **Find your numeric Telegram ID**
   - Message [@userinfobot](https://t.me/userinfobot) on Telegram. It replies with your numeric ID.
   - Save it — you'll set `ALLOWED_SENDERS=<your_id>` on Day 0.
   - **Note**: this is the *number*, not your `@username`. The allowlist rejects everything else.

### Day −5 → −3 — pick your environment

You have two paths. Both are fully supported.

**Path A — Cloud Shell (recommended for first-timers)**
- Zero local setup. Node 22, gcloud, git all preinstalled.
- Browser-based, runs on Google's infra.
- Open it: console.cloud.google.com → terminal icon (top right).

**Path B — local development**
- Mac, Linux, or Windows-with-WSL.
- Requirements:
  - Node.js **22 or newer** (`node --version`). Install via [nodejs.org](https://nodejs.org/) or `nvm install 22`.
  - `git`. Install via [git-scm.com](https://git-scm.com/).
  - `gcloud` CLI for Level 4. Install via [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install).
  - Apple Silicon: works natively, no Rosetta needed.
  - Windows: use [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install) (Ubuntu). Native PowerShell is not supported.

Pick one path and stick with it for the whole workshop. Switching mid-session loses time.

### Day −2 — clone and run preflight (5 minutes)

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/codelab/starter
npm install
cd -                           # back to repo root
./scripts/preflight.sh
```

The preflight script checks 7 things:

| # | Check | Pass when |
|---|---|---|
| 1 | Node.js version | `node --version` reports 22.0.0 or newer |
| 2 | git installed | `git --version` works |
| 3 | gcloud CLI | installed (warning only, required for Level 4) |
| 4 | GCP project set | `gcloud config get-value project` returns a project ID |
| 5 | Gemini API key | present in `.env` and longer than 30 chars |
| 6 | Telegram bot token | present in `.env` and longer than 20 chars |
| 7 | Vertex AI API enabled | `gcloud services list` includes `aiplatform.googleapis.com` |

If you don't have a `.env` yet, that's expected — you'll create it in step 1 of Level 0. You can re-run preflight any time.

### Day −1 — final checklist

- [ ] You can answer "what's my Google Cloud project ID?" without looking it up
- [ ] Your Gemini API key is in your password manager
- [ ] Your Telegram bot replies to messages (test by messaging it `/start` from your account — it won't do anything yet, but the bot should appear online)
- [ ] You know your numeric Telegram ID
- [ ] `node --version` is 22+
- [ ] You've cloned the repo

Anything red? Drop a message in the cohort support channel — your instructor's monitoring it for last-minute unblocks.

## Day 0 — what happens

You'll start with **Level 0 (architecture tour)** — a guided walkthrough of the agent you're about to build. Then you go straight into **Level 1 (Build the Brain)** where you wire the agent loop, register three tools, give it a personality, and put it on Telegram.

By the end of Day 1 you'll be having a real conversation with your own agent.

## Common pre-workshop gotchas

| Symptom | Fix |
|---|---|
| `gcloud: command not found` | Install gcloud CLI, or just use Cloud Shell — it's preinstalled there. |
| `Error: No active project` | `gcloud config set project YOUR_PROJECT_ID` |
| `Failed to enable Vertex AI API` | Billing isn't enabled on your project. Visit [console.cloud.google.com/billing](https://console.cloud.google.com/billing). |
| Node version too low | `nvm install 22 && nvm use 22 && nvm alias default 22` |
| Telegram bot doesn't reply to test messages | Make sure you've actually started a chat with it (search the bot username in Telegram, click Start). |
| `npm install` errors on Apple Silicon | Update Node to the latest 22.x — older builds had M-series issues. |
| WSL: `gcloud auth login` opens browser but won't redirect back | Run `gcloud auth login --no-launch-browser` and copy the URL manually. |

## Privacy + cost notes

- Your Gemini API key is sensitive. Never paste it into a browser form, screenshot it, or commit it. Keep it in `.env` and on disk only.
- The workshop fits inside Gemini's free tier with comfortable headroom for testing.
- Cloud Run scales to zero between requests, so a deployed agent costs nothing while idle.
- If you want to throw away everything at the end of the workshop, `scripts/graduate-cleanup.sh` (Level 4) deletes everything cleanly.

You're ready. See you on Day 1.
