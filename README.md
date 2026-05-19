# 🤖 AdkClaw

![AdkClaw — Autonomous AI Agents on Google ADK](docs/img/hero.png)

**A hands-on workshop where you build an autonomous AI agent — a teammate that lives on Telegram, remembers you across sessions, recovers from any failure, and runs on Google Cloud while you sleep.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-adkclaw.dev-blue?style=for-the-badge)](https://adkclaw.dev)
[![Codelab](https://img.shields.io/badge/Codelab-Level%200-green?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-0/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%201-orange?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-1/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%202-green?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-2/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%203-orange?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-3/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%204-green?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-4/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%205-orange?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-5/instructions)

> **Just want to use it?** → jump to [Quick Start](#-quick-start) · **Want to build it yourself?** → [start at Level 0](level_0/README.md)

## 🎯 The Journey

You've called `client.models.generateContent()`. That's not an agent — it's a function call. A chatbot answers, but your agent will **act**, **remember**, **recover**, and **collaborate** — all on top of Google's Agent Development Kit (ADK) and Gemini.

Across five levels, you'll build the same autonomous-agent reference implementation that drives [adkclaw.dev](https://adkclaw.dev) — written in TypeScript, deployed on Google Cloud, and yours to take home.

| Level | Mission | What You'll Learn |
|-------|---------|-------------------|
| **Level 0** | Tour the architecture and clone the starter | The 6 pillars of an autonomous agent, ADK fundamentals, repo orientation |
| **Level 1** | Build the agent loop and put it on Telegram | The ADK agent loop, function calling, tool registration, personality engineering, SQLite sessions |
| **Level 2** | Give it persistent memory and runtime skills | Workspace bootstrap, memory bank taxonomy, compaction at 80%, markdown skills loader |
| **Level 3** | Spawn sub-agents and make it self-healing | Multi-agent orchestration, isolated sessions, recovery pyramid, cron + heartbeat |
| **Level 4** | Ship to Google Cloud, talk to it from anywhere | Cloud Run deployment, Firestore, Secret Manager, Cloud Scheduler, Telegram webhook |
| **Level 5** | Harden it for production | Threat modeling, admin auth, OIDC for Cloud Scheduler, Cloud DLP, Firestore rules, secret rotation, supply-chain hardening |

## 🛠️ Technology Stack

| Component | Technologies |
|-----------|-------------|
| **Brain** | Google [Agent Development Kit (ADK)](https://google.github.io/adk-docs/) (`@google/genai`), Gemini 3.1 Pro / 3 Flash |
| **Language** | TypeScript 5.6 + Node.js 22+ |
| **Channels** | Telegram (telegraf), Terminal CLI, HTTP API |
| **Storage** | SQLite (better-sqlite3) → Firestore in cloud (Level 4) |
| **Cloud** | Cloud Run, Cloud Storage, Secret Manager, Cloud Scheduler, Cloud Logging |
| **AI/ML** | Vertex AI (embeddings + vector search), Gemini Search Grounding |
| **Tools** | Playwright (browser), pdfkit (PDFs), Marp (slides), Gemini CLI (code-fix) |

## 🚀 Quick Start

AdkClaw has two front doors — pick yours.

### 🟢 Just want to run the agent? (no workshop)

You don't need the workshop to use AdkClaw — the finished framework is ready to run.

**Fastest — via npm:**

```bash
npx adkclaw setup        # interactive: name your agent, paste your keys
npx adkclaw start        # agent boots on http://localhost:3000
```

**Or clone, to read and modify the source:**

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw
npm install
npm run setup            # interactive: name your agent, paste your keys
npm start                # agent boots on http://localhost:3000
```

You'll need a [Gemini API key](https://aistudio.google.com/apikey); a [Telegram bot token](https://t.me/BotFather) is optional. See the [Capabilities Tour](docs/capabilities.md) for what the finished agent can do and [examples/](examples/) for copy-paste recipes.

### 🔵 Want to learn to build it? (workshop)

Build the same framework yourself, level by level.

1. **Read [PREWORK.md](PREWORK.md)** — 7-day prep guide covering accounts, tools, and the 5-minute preflight check. Do this before Day 1.

2. **Open Cloud Shell** at [console.cloud.google.com](https://console.cloud.google.com) and click the terminal icon (top-right). Or work locally with Node.js 22+.

3. **Clone and bootstrap:**
   ```bash
   git clone https://github.com/dahabit/adkclaw.git
   cd adkclaw
   ./scripts/preflight.sh    # 5-minute environment check
   ./scripts/setup.sh        # interactive: paste keys, pick username
   ```

4. **Start with Level 0 (the architecture tour):**
   ```bash
   cat level_0/README.md
   ```

5. **Build, level by level**, in `codelab/starter/` — that's the canonical scaffold. See [ARCHITECTURE.md](ARCHITECTURE.md) for the three-repo layout and level checkpoint tags.

6. **Follow the codelab:** [Level 0 Instructions](https://codelabs.developers.google.com/adkclaw-level-0/instructions)

### 🟠 Hosting a workshop?

The instructor materials (slide decks, run-of-show, speaker notes, demo recovery) live in the private `dahabit/adkclaw-instructor` repo. Request access if you're delivering a cohort.

## 📚 Documentation

| Document | What it covers |
|----------|---------------|
| [Level 0 README](level_0/README.md) | Architecture tour + scaffold orientation |
| [Level 1 README](level_1/README.md) | Build the agent loop, register tools, give it personality, wire Telegram |
| [Level 2 README](level_2/README.md) | Memory bank, compaction at 80%, markdown skills, runtime extensibility |
| [Level 3 README](level_3/README.md) | Sub-agent profiles, recovery pyramid, cron + heartbeat, admin dashboard |
| [Level 4 README](level_4/README.md) | Containerize, Firestore migration, Cloud Run deploy, Telegram webhook, Cloud Scheduler |
| [Level 5 README](level_5/README.md) | Harden the cloud — threat model, OIDC, FATAL gates, Cloud DLP, Firestore rules, secret rotation |
| [Tech Stack Audit](docs/tech-stack.md) | Google vs open-source dependencies, with rationale per package |
| [Capabilities Tour](docs/capabilities.md) | What the finished agent can do — 8 wow demos |
| [API Reference](docs/api.md) | All HTTP endpoints with curl examples |
| [Architecture File Map](ARCHITECTURE.md) | Three-repo layout (public / instructor / platform) + level checkpoint tags |
| [Pre-workshop guide](PREWORK.md) | 7-day prep: accounts, tools, preflight |
| [Post-workshop guide](POST_WORKSHOP.md) | Graduation, certificate, extension projects |

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AdkClaw                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Workshop Journey                                                       │
│   ────────────────                                                       │
│                                                                          │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────┐ │
│   │ Level 0  │──▶│ Level 1  │──▶│ Level 2  │──▶│ Level 3  │──▶│ L4   │ │
│   │ Tour     │   │ Brain    │   │ Memory   │   │ Army     │   │ Cloud│ │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────┘ │
│                                                                          │
│   Final Architecture (after Level 5)                                     │
│   ──────────────────────────────────                                     │
│                                                                          │
│   ┌──────────┐                ┌──────────────────────┐                  │
│   │ Telegram │ ──webhook────▶ │   Cloud Run          │                  │
│   └──────────┘                │   adkclaw container  │                  │
│                               │   • AgentRunner      │ ──▶ Vertex AI    │
│                               │   • 21 tools         │     (Gemini)     │
│                               │   • HealingEngine    │                  │
│                               │   • Multi-Agent      │                  │
│                               └──────────┬───────────┘                  │
│                                          │                               │
│            ┌─────────────────────────────┼─────────────────────────┐   │
│            ▼                             ▼                         ▼   │
│   ┌──────────────────┐    ┌─────────────────────┐   ┌────────────────┐ │
│   │ Secret Manager   │    │  Firestore          │   │  Cloud Storage │ │
│   │ • Gemini key     │    │  • sessions         │   │  • IDENTITY.md │ │
│   │ • Telegram token │    │  • messages         │   │  • SOUL.md     │ │
│   │ • allowlist      │    │  • cron jobs/runs   │   │  • bank/       │ │
│   └──────────────────┘    └─────────────────────┘   └────────────────┘ │
│                                                                          │
│   ┌──────────────────┐                                                   │
│   │ Cloud Scheduler  │ ──HTTPS POST──▶ Cloud Run /api/cron/fire         │
│   └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🌐 Deployment

### Deploy Your Own Instance (Workshop Hosts)

1. **Prerequisites:**
   - Google Cloud project with billing enabled
   - Cloud Shell or local environment with `gcloud` CLI
   - A [Gemini API key](https://aistudio.google.com/apikey)
   - A [Telegram bot token](https://t.me/BotFather)

2. **Clone and configure:**
   ```bash
   git clone https://github.com/<your-org>/adkclaw.git
   cd adkclaw
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Run infrastructure setup:**
   ```bash
   ./scripts/setup-infrastructure.sh
   ```

4. **Deploy all services:**
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

### Environment Configuration

After running `./scripts/setup.sh`, a `set_env.sh` file is generated at the project root:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export REGION="us-central1"
export GEMINI_API_KEY="..."
export TELEGRAM_BOT_TOKEN="..."
export ALLOWED_SENDERS="..."
```

Source it before running any level: `source ~/adkclaw/set_env.sh`

## 🎓 Workshop Hosting Guide

The full hosting playbook (slide decks, run-of-show, speaker notes, demo recovery, cohort comms, 24-hour preflight) lives in the private `dahabit/adkclaw-instructor` repo. Request access if you're delivering a cohort.

### Public-side basics

1. **Provision Google Cloud credits** for participants — the workshop fits comfortably inside Gemini's free tier with Cloud Run scaling to zero.
2. **Deploy a sandbox event** so students can run levels independently against the public sandbox.
3. **Create an event code** via the admin panel in the platform repo (`dahabit/adkclaw-platform`).
4. **Test the full flow** end-to-end with a sample participant before going live.
5. **Generate QR codes / invite links** pointing to the event setup page.

### During the Workshop

1. Share the event code on slides.
2. Participants run `./scripts/setup.sh` → enter event code → choose username.
3. Direct them to the [Level 0 Codelab](https://codelabs.developers.google.com/adkclaw-level-0/instructions).
4. Monitor the live dashboard: `https://adkclaw.dev/e/your-event-2026`
5. Each level activates a new "pillar" badge on each participant's profile — celebrate completions in real time.

### Stay within free tier

Cloud Run scales to zero between sessions and Gemini's free tier covers the workshop comfortably. Participants don't burn budget when idle. For workshop hosts running large cohorts, see the cohort sizing notes in the private instructor materials.

## 🤝 Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

### Development Setup

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/codelab/starter
npm install
cp .env.example .env       # add your keys
npm run dev
```

### Level checkpoints

The starter scaffold grows level by level. If you fall behind or want to skip ahead, use the git tags:

```bash
git checkout v2-complete -- codelab/starter/   # post-Level 2 baseline
git checkout v3-complete -- codelab/starter/   # post-Level 3 baseline
```

The full reference implementation (post-Level 4 finished agent with all 21 tools) lives at `src/` in this repo. Study it as the answer key.

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE) for details.

## 👤 Author

**Ahmed Abu Eldahab** — Google Developer Expert · Flutter & Dart

- GitHub: [@dahabit](https://github.com/dahabit)
- YouTube: [@h3boh3bo](https://www.youtube.com/@h3boh3bo)
- X: [@dahabdev](https://x.com/dahabdev)
- LinkedIn: [in/dahabit](https://www.linkedin.com/in/dahabit/)

## 🛠️ Stack

Built on [Google Agent Development Kit (ADK)](https://google.github.io/adk-docs/), [Gemini](https://deepmind.google/technologies/gemini/), [Cloud Run](https://cloud.google.com/run), [Firestore](https://cloud.google.com/firestore), [Cloud Scheduler](https://cloud.google.com/scheduler), and [Vertex AI](https://cloud.google.com/vertex-ai).

## 🌟 Star History

If AdkClaw helps you teach autonomous agents, give us a star — it helps other instructors find this curriculum.

---

**Ready to build your autonomous AI teammate?** Start with [Level 0](level_0/README.md) 🚀

© Ahmed Abu Eldahab · Apache 2.0 licensed
