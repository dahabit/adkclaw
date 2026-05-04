# Level 0: Architecture Tour

![Level 0: Architecture Tour](img/architecture.png)

**Get oriented before you build. Learn the six pillars of an autonomous agent and tour the AdkClaw repo from top to bottom.**

You're about to build an autonomous AI agent across the next four levels. Before any code, you need a map of the territory: what an agent actually *is*, what makes one autonomous, what's Google's tech and what's open-source plumbing, and where every concept lives in the codebase. Forty-five minutes of orientation now will save four hours of head-scratching later.

## 🎯 What You'll Learn

| Concept | Description |
|---------|-------------|
| **The 6 pillars of an autonomous agent** | Brain, tools, memory, personality, self-healing, sub-agents — each one a workshop pillar |
| **Google ADK fundamentals** | The `@google/genai` SDK, Gemini 2.5 Pro / Flash, function calling, grounding |
| **Tech stack rationale** | Why TypeScript, why SQLite, why no LangChain — every decision defendable |
| **Repo structure** | Every folder mapped to a pillar; every workshop mapped to a folder |
| **Cloud Shell setup** | `./scripts/setup.sh`, env vars, project selection, API enablement |
| **The journey** | What you'll have at the end of each level |

## ✅ What You'll Build

By the end of this level, you will have:

- 🧭 A clear mental model of what an autonomous agent is — not a chatbot with extra steps
- 📂 A cloned repo with all dependencies installed in Cloud Shell
- 🔑 Enabled APIs (Vertex AI, Cloud Run, Cloud Build, Secret Manager, Firestore, Cloud Storage, Cloud Scheduler)
- ✅ A passing `npx adkclaw check` that verifies your environment
- 🚀 Confidence to start building in Level 1

This level is **presentation-style** — no agent code yet. You read, you watch the demo, you set up. Ship line of code: zero. Conceptual ground covered: massive.

## 📋 Prerequisites

- ✅ Google Cloud project with billing enabled
- ✅ Cloud Shell access (recommended) or local Node.js 22+ environment
- ✅ A free [Gemini API key](https://aistudio.google.com/apikey) (used in Level 1)
- ✅ A [Telegram bot token](https://t.me/BotFather) (used in Level 1) — send `/newbot` to BotFather
- ✅ ~60 minutes (45 min reading + demo, 15 min setup)

## 🚀 Quick Start

### 1. Open Cloud Shell

Go to [console.cloud.google.com](https://console.cloud.google.com), select your project, and click the terminal icon (top-right) to open Cloud Shell.

### 2. Clone the repo

```bash
git clone https://github.com/<your-org>/adkclaw.git
cd adkclaw
```

### 3. Run the bootstrap script

```bash
./scripts/setup.sh
```

This will:
- Verify your gcloud authentication and active project
- Enable required APIs (Vertex AI, Cloud Run, Cloud Build, Secret Manager, Firestore, Storage, Cloud Scheduler, Logging)
- Prompt for your event code and username (use `sandbox` for self-learning)
- Prompt for your Gemini API key and Telegram bot token (or skip — you can add them in Level 1)
- Generate `config.json` and `set_env.sh` for the rest of the workshop

### 4. Source the env file

```bash
source ~/adkclaw/set_env.sh
```

### 5. Read the architecture overview

```bash
cd level_0
cat docs/teaching-guide.md
```

Skim the **Six Pillars**, **Why TypeScript / Why Google ADK**, and **The Request Flow** sections.

### 6. Tour the repo (live with your instructor or solo)

```bash
# Top-level
ls

# Each level is a self-contained working tree
ls level_1/
ls level_2/
ls level_3/
ls level_4/

# Solutions parallel structure (don't peek yet!)
ls solutions/
```

### 7. Run the pre-flight check

```bash
cd level_1
npm install
npx adkclaw check
```

You should see all green ticks. If `ALLOWED_SENDERS` is missing, that's expected — Level 1 covers it.

## 📖 Full Codelab

For detailed step-by-step instructions with the architecture deep-dive:

**[📚 Level 0 Codelab →](https://codelabs.developers.google.com/adkclaw-level-0/instructions)**

## 🔑 The Six Pillars (the mental model)

Every autonomous agent has six things. Take any away and it stops being autonomous. AdkClaw teaches each one by building it:

| Pillar | What it means | Where it lives | Workshop |
|--------|---------------|---------------|----------|
| **Brain** | The LLM that thinks (Gemini via ADK) | `src/agent/runner.ts` | Level 1 |
| **Tools** | Hands to act on the world | `src/tools/` (21 tools) | Level 1 |
| **Memory** | Survives turns, days, restarts | `src/context/`, `src/memory/`, `workspace/` | Level 2 |
| **Personality** | Identity and tone, not just text | `workspace/IDENTITY.md`, `SOUL.md` | Level 1 |
| **Self-healing** | Never crashes — recovers from any error tier | `src/healing/` | Level 3 |
| **Sub-agents** | Specialists collaborating with the main agent | `src/multi-agent/` | Level 3 |

A **chatbot** has only Brain. A **RAG system** has Brain + retrieval. **Autonomy** means all six.

## 🏗️ Architecture (final state, after Level 4)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AdkClaw on Cloud Run                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Telegram (webhook) ──┐                                                 │
│                         │     ┌──────────────────────┐                  │
│   CLI REPL (HTTP) ──────┼────▶│   Cloud Run service  │                  │
│                         │     │   • AgentRunner       │ ──▶ Vertex AI   │
│   HTTP /api/chat ───────┘     │   • 21 tools         │      (Gemini)   │
│                               │   • HealingEngine    │                  │
│                               │   • Sub-agents       │                  │
│                               └──────────┬───────────┘                  │
│                                          │                               │
│            ┌─────────────────────────────┼─────────────────────────┐   │
│            ▼                             ▼                         ▼   │
│   ┌──────────────────┐    ┌─────────────────────┐   ┌────────────────┐ │
│   │ Secret Manager   │    │ Firestore           │   │ Cloud Storage  │ │
│   │ • API keys       │    │ • sessions          │   │ • workspace/   │ │
│   │ • allowlist      │    │ • messages          │   │ • bank/        │ │
│   └──────────────────┘    │ • cron jobs/runs    │   │ • skills/      │ │
│                           └─────────────────────┘   └────────────────┘ │
│                                                                          │
│   ┌──────────────────┐                                                   │
│   │ Cloud Scheduler  │ ──HTTPS POST──▶ Cloud Run /api/cron/fire         │
│   └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack Audit (Google vs. open-source)

| Layer | Provider | Why |
|-------|----------|-----|
| **LLM (brain)** | **Google** — `@google/genai`, Gemini 2.5 | First-party SDK, 1M context, native function calling |
| **Web search grounding** | **Google** — built into Gemini | Citation-aware, real-time |
| **Embeddings + vector search** | **Google** — Vertex AI | When semantic memory outgrows SQLite cosine |
| **Cloud hosting + storage + cron + secrets** | **Google Cloud** | Cloud Run, Firestore, Secret Manager, Cloud Scheduler, Cloud Logging |
| HTTP server | Express (open source) | Most familiar Node.js framework |
| Telegram bot | telegraf (open source) | Typed wrapper saves 250 LOC vs. raw Bot API |
| Local DB | better-sqlite3 (open source) | Embedded, sync, zero config |
| Browser automation | Playwright (Microsoft) | JS rendering + `page.pdf()` |
| PDFs / slides | pdfkit, Marp (open source) | Programmatic content generation |

> **The brain is Google. The plumbing is open source. Level 4 swaps the plumbing for Google Cloud equivalents.** See [`docs/tech-stack.md`](../docs/tech-stack.md) for the full audit.

## 📁 Repo Map

| Folder | Contents | Role |
|--------|----------|------|
| `level_0/` | This README, architecture diagrams, pre-flight check | Architecture tour |
| `level_1/` | Self-contained agent + Telegram + sessions | Level 1 working tree |
| `level_2/` | Adds memory bank, compaction, skills | Level 2 working tree |
| `level_3/` | Adds sub-agents, healing, cron, dashboard | Level 3 working tree |
| `level_4/` | Cloud-ready (Dockerfile, deploy scripts, Firestore adapter) | Level 4 working tree |
| `solutions/level_N/` | Complete answer keys (don't peek until you've tried) | Reference implementations |
| `scripts/` | `setup.sh`, `setup-infrastructure.sh`, `verify_setup.py` | Shared bootstrap |
| `docs/` | `teaching-guide.md`, `tech-stack.md`, `capabilities.md`, `api.md` | Reference material |
| `test/` | End-to-end smoke tests | CI verification |

Each `level_N/` is a **complete working tree** — you can clone any one and run it standalone without doing previous levels.

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `gcloud: command not found` | Open Cloud Shell at [console.cloud.google.com](https://console.cloud.google.com) — gcloud is pre-installed there |
| `Error: No active project` | Run `gcloud config set project <YOUR_PROJECT_ID>` then re-run setup |
| `Failed to enable Vertex AI API` | Billing isn't enabled on your project. Visit [Cloud Console → Billing](https://console.cloud.google.com/billing). |
| `Node version too low` | In Cloud Shell: `nvm install 22 && nvm use 22 && nvm alias default 22` |
| Pre-flight check shows missing `ALLOWED_SENDERS` | Expected — Level 1 covers Telegram setup |

## ➡️ Next Level

Now that you understand the territory, it's time to build:

**[Level 1: Build the Brain →](../level_1/README.md)**

You'll wrap the Gemini API in an agent loop, register three tools, give your agent a name and a personality, and put it on Telegram in 2 hours.

---

*The map is in your hands, explorer. Time to start building.* 🤖
