# 🤖 AdkClaw

![AdkClaw — Autonomous AI Agents on Google ADK](docs/img/hero.png)

**A hands-on workshop where you build an autonomous AI agent — a teammate that lives on Telegram, remembers you across sessions, recovers from any failure, and runs on Google Cloud while you sleep.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-adkclaw.dev-blue?style=for-the-badge)](https://adkclaw.dev)
[![Codelab](https://img.shields.io/badge/Codelab-Level%200-green?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-0/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%201-orange?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-1/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%202-green?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-2/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%203-orange?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-3/instructions)
[![Codelab](https://img.shields.io/badge/Codelab-Level%204-green?style=for-the-badge)](https://codelabs.developers.google.com/adkclaw-level-4/instructions)

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

## 🛠️ Technology Stack

| Component | Technologies |
|-----------|-------------|
| **Brain** | Google [Agent Development Kit (ADK)](https://google.github.io/adk-docs/) (`@google/genai`), Gemini 2.5 Pro / Flash |
| **Language** | TypeScript 5.6 + Node.js 22+ |
| **Channels** | Telegram (telegraf), Terminal CLI, HTTP API |
| **Storage** | SQLite (better-sqlite3) → Firestore in cloud (Level 4) |
| **Cloud** | Cloud Run, Cloud Storage, Secret Manager, Cloud Scheduler, Cloud Logging |
| **AI/ML** | Vertex AI (embeddings + vector search), Gemini Search Grounding |
| **Tools** | Playwright (browser), pdfkit (PDFs), Marp (slides), Gemini CLI (code-fix) |

## 🚀 Quick Start

### For Workshop Participants

1. **Open Cloud Shell** at [console.cloud.google.com](https://console.cloud.google.com) and click the terminal icon (top-right).

2. **Clone and bootstrap:**
   ```bash
   git clone https://github.com/<your-org>/adkclaw.git
   cd adkclaw
   ./scripts/setup.sh
   ```

3. **Start with Level 0 (the architecture tour):**
   ```bash
   cd level_0
   cat README.md
   ```

4. **Follow the codelab:** [Level 0 Instructions](https://codelabs.developers.google.com/adkclaw-level-0/instructions)

### For Workshop Hosts

See the [Workshop Hosting Guide](#-workshop-hosting-guide) below for running your own cohort with Google Cloud credits.

## 📚 Documentation

| Document | What it covers |
|----------|---------------|
| [Level 0 README](level_0/README.md) | Architecture tour + scaffold orientation |
| [Level 1 README](level_1/README.md) | Build the agent loop, register tools, give it personality, wire Telegram |
| [Level 2 README](level_2/README.md) | Memory bank, compaction at 80%, markdown skills, runtime extensibility |
| [Level 3 README](level_3/README.md) | Sub-agent profiles, recovery pyramid, cron + heartbeat, admin dashboard |
| [Level 4 README](level_4/README.md) | Containerize, Firestore migration, Cloud Run deploy, Telegram webhook, Cloud Scheduler |
| [Teaching Guide](docs/teaching-guide.md) | Why every architecture decision was made — for instructors |
| [Tech Stack Audit](docs/tech-stack.md) | Google vs open-source dependencies, with rationale per package |
| [Capabilities Tour](docs/capabilities.md) | What the finished agent can do — 8 wow demos |
| [API Reference](docs/api.md) | All HTTP endpoints with curl examples |
| [Architecture File Map](docs/architecture-file-map.md) | Every source file mapped to its role and workshop |

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
│   Final Architecture (after Level 4)                                     │
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

### Before the Workshop

1. **Provision Google Cloud credits** for participants ($25 covers a participant through all 5 levels with margin).
2. **Deploy a sandbox event** — students can run levels independently against the public sandbox.
3. **Create an event code** in your admin panel:
   ```bash
   ./scripts/create_event.py --code "your-event-2026" --name "Your Workshop Name"
   ```
4. **Test the full flow** with a sample participant from start to finish.
5. **Generate the QR codes / invite links** pointing to the event setup page.

### During the Workshop

1. Share the event code on slides.
2. Participants run `./scripts/setup.sh` → enter event code → choose username.
3. Direct them to the [Level 0 Codelab](https://codelabs.developers.google.com/adkclaw-level-0/instructions).
4. Monitor the live dashboard: `https://adkclaw.dev/e/your-event-2026`
5. Each level activates a new "pillar" badge on each participant's profile — celebrate completions in real time.

### Cost Estimates

| Component | Approximate Cost (per participant, all 5 levels) |
|-----------|------------------------------------------------|
| Level 0 (architecture tour, no API calls) | $0 |
| Level 1 (basic agent + tools) | ~$0.50 (Gemini Pro turns) |
| Level 2 (memory + compaction LLM calls) | ~$1.50 |
| Level 3 (sub-agents + healing demos) | ~$2 |
| Level 4 (Cloud Run deploy + 1h runtime) | ~$1 (most components scale to zero) |
| **Total per participant** | **~$5** |

Cloud Run scales to zero between sessions; participants don't burn money when idle.

## 🤝 Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

### Development Setup

```bash
# Clone the repo
git clone https://github.com/<your-org>/adkclaw.git
cd adkclaw

# Each level is self-contained — pick one
cd level_1
npm install
cp .env.example .env  # add your keys
npm run dev
```

### Solutions

Each level has a parallel `solutions/level_N/` folder with the complete implementation. Use it as the answer key when teaching.

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
