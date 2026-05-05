# AdkClaw — Project Overview

A single-document reference covering what AdkClaw is, why it exists, what's inside it, and how every piece fits together. Hand this to a new contributor, a partner, a workshop host, or a Google reviewer and they should know the project end to end.

---

## 1. What is AdkClaw?

**AdkClaw is a hands-on workshop and reference implementation for building autonomous AI agents on Google's Agent Development Kit (ADK) and Gemini.**

Across **five progressive levels (~9.5 hours)**, students build the same agent that powers [adkclaw.dev](https://adkclaw.dev) — written in TypeScript, deployed on Google Cloud, and theirs to take home.

The agent that gets built:
- Lives on **Telegram** as a personal teammate
- **Remembers** the user across sessions (memory bank + compaction)
- **Acts** through 21 tools (web search, browser, files, shell, content creation, cron, sub-agents)
- **Recovers** from failures via a 5-tier healing pyramid
- **Spawns sub-agents** to delegate specialised work
- **Runs on Cloud Run** with Firestore, Secret Manager, and Cloud Scheduler

It is **not** a chatbot. It is an operator with hands.

---

## 2. Purpose

| Goal | What this means |
|------|-----------------|
| **Teach the leap from API call to autonomous agent** | Most tutorials stop at `client.models.generateContent()`. AdkClaw starts there and ends with a self-healing multi-agent system on Cloud Run. |
| **Be Google-stack reference quality** | Built to be submitted to the official Google ADK codelab series. Apache 2.0, claat-format ready, GDE-grade polish. |
| **TypeScript counterpart to Ahmed's Flutter Talk 10** | "Teaching AI to Your Flutter App — From Zero to Agentic" addresses Flutter audiences; AdkClaw covers TS/JS audiences with the same progression. |
| **Train trainers** | Every level ships an `INSTRUCTOR.md` with run-of-show, demo scripts, recovery scripts, FAQ, and a certification path so MENA developer-community leads can teach it. |
| **BYOK and own-your-agent** | Students bring their own Gemini key, Telegram bot, and GCP project. The platform never proxies LLM calls or stores keys. Each agent survives the workshop on the student's own Cloud Run. |

---

## 3. Author & positioning

**Ahmed Abu Eldahab** — Google Developer Expert in Dart & Flutter, 24 years of professional software engineering. Socials: `dahabdev` on LinkedIn / X / YouTube / Facebook / Instagram.

AdkClaw fits Ahmed's wider GDE portfolio:

| Asset | Audience | Stack |
|-------|----------|-------|
| 10 GDE talks (Flutter + AI) | Conference attendees, GDE community | Flutter + Dart |
| YouTube `@h3boh3bo` (10 videos planned) | Self-paced learners | Flutter primarily |
| Maqare, Anas, Murtel | End users + B2B clients | Flutter + Node/Django |
| **AdkClaw** | **TS/JS developers entering ADK** | **TypeScript + Node** |

**Branding rule (locked):** wording uses "**Google Technologies**" (not "Powered by Google") with the disclaimer: *"AdkClaw is community-built and not officially affiliated with Google."* Public surfaces credit only Ahmed — no "inspired by" footers.

---

## 4. Repositories

Two physically separate folders, two GitHub repos, two licenses.

| Repo | Path | License | Contents |
|------|------|---------|----------|
| **Public** `dahabit/adkclaw` | `~/agents/adkclaw/` | Apache 2.0 | `src/`, `level_0..4/`, `solutions/`, `docs/`, `platform/`, `scripts/`, `codelab/starter/`, `workspace.example/`, build files |
| **Private** `dahabit/adkclaw-instructor` | `~/agents/adkclaw-instructor/` | Proprietary | `strategy/`, `briefs/`, `full-prompts/`, `presentations/`, `recordings/`, `live-events/` |

Separation is **physical**, not gitignore-based — strategy content cannot leak into the public repo because it isn't in that directory tree.

Domain: `adkclaw.dev` (registered at name.com). Subdomains: `api.adkclaw.dev` (workshop API), `agent.adkclaw.dev` (live demo), `*.adkclaw.dev` (Phase 3 student agents).

---

## 5. The five levels (curriculum spine)

Locked in `workshop.config.json`:

| Level | Slug | Title | Duration | Type | What's added |
|------:|------|-------|---------:|------|--------------|
| 0 | `intro` | Architecture Tour | 60 min | Presentation | Concepts, repo orientation, the 6 pillars |
| 1 | `build-the-brain` | Build the Brain | 120 min | Hands-on | Agent loop, function calling, tool registration, personality, Telegram, SQLite sessions |
| 2 | `memory-and-skills` | Memory & Skills | 120 min | Hands-on | Workspace bootstrap, memory bank taxonomy, compaction at 80%, markdown skills loader |
| 3 | `agent-army` | The Agent Army | 120 min | Hands-on | Sub-agents, healing pyramid, cron + heartbeat, admin dashboard |
| 4 | `cloud-deploy` | Ship to the Cloud | 150 min | Hands-on | Cloud Run, Firestore, Secret Manager, Cloud Scheduler, Telegram webhook |

**Total: ~9.5 hours of teaching content.**

Each level ships three documents:

1. **`codelab.md`** — Google Codelabs format (publishable to claat)
2. **`INSTRUCTOR.md`** — 8-section template: prep, run-of-show, demo script, pitfalls, FAQ, recovery scripts, timing, train-the-trainer cert path
3. **`RESOURCES.md`** — "if a student asks X" Q&A table

L0 + L1 are content-complete. L2/L3/L4 ship next iterations on the same template.

### Curriculum vision (v3, 2026-05-04)

- **Part 1 (L0–L4)** — Foundation: ship a working autonomous agent.
- **Part 2 (post-Cohort-1)** — Five project-based application tracks chosen by student demand: Coder, Researcher, Voice Tutor, Productivity Operator, Multi-Agent Orchestrator.

Pattern follows Google's most popular agent codelabs (Marathon Planner, Kitchen Renovation, Aidemy, Survivor Network) — each builds a **project**, not a feature. Retired the earlier feature-based L5–L8 framing.

---

## 6. The six pillars of an autonomous agent

The conceptual spine of the curriculum. Each level adds one or two pillars.

1. **Agent loop** — `for` loop: ask the LLM, execute its tool calls, append results, repeat until text. (`src/agent/runner.ts`)
2. **Tools / function calling** — 21 tools, each with a JSON Schema and an async `execute()`. The LLM picks tools by their *description*. (`src/tools/`)
3. **Persistent memory + compaction at 80%** — Memory bank with daily notes, decisions, projects, people. Compacts conversation history when it crosses 80% of model context. (`src/memory/`, `src/sessions/`)
4. **Markdown skills loader** — Drop a `.md` file in `workspace/skills/` and the agent can `load_skill('research')` to pull behaviour at runtime. (`src/skills/`)
5. **Multi-agent orchestration + self-healing recovery pyramid** — Spawn sub-agents with isolated sessions; classify and recover from failures via 5 tiers. (`src/multi-agent/`, `src/healing/`)
6. **Channels + cloud deploy** — Telegram (`telegraf`) + CLI REPL + HTTP API; ships to Cloud Run with Firestore + Secret Manager + Cloud Scheduler.

---

## 7. Technology stack

| Component | Technology |
|-----------|-----------|
| **Brain** | `@google/genai` (ADK), Gemini 2.5 Pro / Flash |
| **Language** | TypeScript 5.6 + Node.js 22+ |
| **Channels** | `telegraf` (Telegram), Terminal CLI, HTTP API (Express) |
| **Storage** | `better-sqlite3` (local) → Firestore (Cloud Run) |
| **Cloud** | Cloud Run, Cloud Storage, Secret Manager, Cloud Scheduler, Cloud Logging |
| **AI/ML** | Vertex AI (embeddings + vector search), Gemini Search Grounding |
| **Tools runtime** | Playwright (browser), pdfkit (PDFs), Marp (slides), Gemini CLI (code-fix) |
| **Tests** | Vitest (145 passing) |
| **Build** | tsc, Docker, pm2, systemd |
| **Format** | Prettier (`.prettierrc.json`, `.prettierignore`) |

> **Model versioning policy:** the workshop pins Gemini IDs in `workshop.config.json` (`default_model`, `fallback_model`). Google deprecates older Gemini generations on a published cadence — when you run a cohort, **check the [Gemini API models page](https://ai.google.dev/gemini-api/docs/models) for the current stable IDs** and update `workshop.config.json` if needed. The `client.models.generateContent({ model })` API surface is stable across generations; only the model strings change. The agent's tool registry, healing pyramid, and Cloud Run deploy code are model-version-agnostic.

### Direct dependencies (`package.json`)

```
@google/genai      ^1.0.0       — ADK / Gemini client
better-sqlite3     ^11.3.0      — local sessions & cron persistence
express            ^4.21.0      — HTTP server
telegraf           ^4.16.3      — Telegram bot
playwright         ^1.59.1      — headless browser tools
pdfkit             ^0.18.0      — PDF generation
node-cron          ^3.0.3       — in-process scheduler
yaml               ^2.5.1       — agent.yaml parsing
dotenv             ^16.4.5      — .env loading
```

**Why Vitest over Jest?** Native ESM, faster startup, better TS DX for the workshop pace.

---

## 8. Repo layout

```
~/agents/adkclaw/
├── src/                        # The reference agent (~5,300 LOC, 145 tests)
│   ├── index.ts                # Daemon entrypoint — wires everything together
│   ├── agent/                  # The agent loop (runner.ts, budget.ts)
│   ├── channels/               # telegram.ts (telegraf adapter)
│   ├── cli/                    # setup.ts, repl.ts, index.ts
│   ├── config/                 # loadConfig + validateConfig
│   ├── context/                # ContextEngine: builds the system prompt from workspace/
│   ├── cron/                   # CronEngine + Heartbeat
│   ├── healing/                # 5-tier recovery pyramid (classifier + engine)
│   ├── lib/                    # Shared utilities
│   ├── memory/                 # bank.ts, consolidator.ts, daily-notes.ts
│   ├── multi-agent/            # Orchestrator + 5 sub-agent profiles
│   ├── server/                 # HTTP server (chat, cron, badge endpoints)
│   ├── sessions/               # SessionStore (SQLite)
│   ├── skills/                 # Markdown skills loader
│   ├── tools/                  # 21 tools
│   └── types/                  # Shared TS types
├── level_0/ … level_4/         # Per-level scaffolds + codelab.md + INSTRUCTOR.md + RESOURCES.md
├── codelab/starter/            # 45-file student starter scaffold (12/12 tests pass)
├── solutions/                  # Per-level reference solutions (answer key)
├── platform/                   # The adkclaw.dev platform
│   ├── api/                    # Express + Firestore + HMAC auth (workshop API)
│   ├── frontend/               # Next.js (adkclaw.dev marketing + dashboards)
│   └── deploy/                 # deploy-all.sh
├── workspace/                  # Live agent state (gitignored — the agent's brain)
├── workspace.example/          # Template workspace (committed reference)
├── docs/                       # Deeper docs (api, capabilities, internals, teaching-guide…)
├── data/                       # SQLite DBs + run artefacts (gitignored)
├── scripts/                    # setup.sh + setup helpers
├── bin/                        # adkclaw CLI (start/stop/bg/open)
├── test/                       # fixtures + integration + unit
├── systemd/                    # service files
├── ARCHITECTURE.md             # File-by-file map for instructors (15 KB, 291 lines)
├── DEVELOPER.md                # 21 KB, 623 lines — full dev guide
├── README.md                   # Public landing (245 lines)
├── CONTRIBUTING.md
├── LICENSE                     # Apache 2.0
├── package.json                # name "adkclaw", bin: adkclaw → dist/cli/index.js
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile + docker-compose.yml + pm2.config.cjs
├── agent.yaml                  # name: AdkClaw, tone: friendly, traits…
└── workshop.config.json        # Levels, default region, default model
```

---

## 9. The 21 tools (the agent's hands)

| Tool | What it does | Example prompt |
|------|--------------|----------------|
| `web_search` | Google Search grounding via Gemini | *"What happened in tech today?"* |
| `web_fetch` | URL → markdown | *"Summarize https://flutter.dev/docs"* |
| `browser_fetch` | JS-heavy pages with Playwright | *"Get live data from this dashboard URL"* |
| `browser_screenshot` | Visit page, screenshot | *"Screenshot github.com homepage"* |
| `browser_pdf` | Webpage → PDF | *"Save flutter.dev/docs as a PDF"* |
| `filesystem` | Read/write/list inside `workspace/` | *"List my workspace"* |
| `shell` | Run shell commands (asks first) | *"Show me running processes"* |
| `text_create` | Write a markdown/text file | *"Write a 3-section report on RAG"* |
| `presentation_create` | Marp slide deck | *"Make a 5-slide deck on Google ADK"* |
| `pdf_create` | Generate a PDF document | *"Generate a brief on autonomous agents"* |
| `code_fix` | Read error → propose & apply fix → verify | *"Fix the bug in workspace/output/script.js"* |
| `memory_save` | Persist a fact / decision / project / person | *"Remember I use Riverpod for Flutter"* |
| `memory_recall` | Search the memory bank | *"What do you know about my preferences?"* |
| `daily_append` | Add to today's daily note | *"Note: had a productive session"* |
| `load_skill` | Load `.md` skill from `workspace/skills/` | *"Use the research skill to look into X"* |
| `list_skills` | List available skills | *"What skills do you have?"* |
| `cron_add` | Schedule a recurring or one-time job | *"Every day at 9am, check Flutter news"* |
| `cron_remove` | Remove a scheduled job | *"Remove the Flutter news job"* |
| `cron_list` | List all scheduled jobs | *"Show my schedule"* |
| `message_user` | Proactive delivery (cron/heartbeat) | *(automatic)* |
| `spawn_agent` (+ 4 profiles) | Delegate to specialised sub-agent | *(see below)* |

### Sub-agent profiles (`src/multi-agent/profiles/`)

- `spawn_search` — research delegate (web_search + web_fetch)
- `spawn_communicator` — drafts/edits messages
- `spawn_researcher` — long-form investigation
- `spawn_coder` — code-focused tasks (with `code_fix`)
- generic `spawn_agent` for ad-hoc roles

Each sub-agent runs in an **isolated session** with a forked context — failures don't poison the parent.

---

## 10. The agent's workspace (its "brain on disk")

Every agent has a `workspace/` directory that acts as its persistent identity. The committed `workspace.example/` shows the template.

```
workspace/
├── IDENTITY.md     # Who the agent is (name, role, personality)
├── SOUL.md         # Core values, voice, what it cares about
├── USER.md         # What it knows about the user
├── MEMORY.md       # Index into bank/
├── AGENTS.md       # Sub-agent registry
├── TOOLS.md        # Tool documentation it should know about
├── HEARTBEAT.md    # Last heartbeat state, recent activity
├── bank/           # Memory bank — structured facts, decisions, projects, people
├── memory/         # Daily notes (YYYY-MM-DD.md)
├── output/         # Files the agent generates (PDFs, slides, code)
└── skills/         # Markdown skills (loadable via `load_skill`)
```

The **`ContextEngine`** reads these files in a fixed order on every turn, caches by mtime, and assembles the system prompt. Edit a workspace file → the agent's behaviour changes on the next turn. **No deploy needed.**

---

## 11. Architecture (final state, after Level 4)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AdkClaw                                     │
├─────────────────────────────────────────────────────────────────────────┤
│   Telegram ── webhook ─▶  Cloud Run                                      │
│                            adkclaw container                             │
│                            • AgentRunner                                 │
│                            • 21 tools                ─▶ Vertex AI        │
│                            • HealingEngine               (Gemini)        │
│                            • Multi-Agent                                 │
│                            └────┬───────────────┐                        │
│                                 ▼               ▼                        │
│              ┌──────────────────┐    ┌─────────────────────┐             │
│              │ Secret Manager   │    │  Firestore          │             │
│              │ • Gemini key     │    │  • sessions         │             │
│              │ • Telegram token │    │  • messages         │             │
│              │ • allowlist      │    │  • cron jobs/runs   │             │
│              └──────────────────┘    └─────────────────────┘             │
│              ┌──────────────────┐    ┌─────────────────────┐             │
│              │ Cloud Storage    │    │  Cloud Scheduler    │             │
│              │ • IDENTITY.md    │    │  ── HTTPS POST ──▶  │             │
│              │ • SOUL.md        │    │   /api/cron/fire    │             │
│              │ • bank/          │    └─────────────────────┘             │
│              └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### The agent loop (the heart)

`src/agent/runner.ts` is the **only** file that calls Gemini. It is a `for` loop:

1. Build context (workspace + recent session messages)
2. Call `client.models.generateContent({...})`
3. If response has tool calls → dispatch to `ToolRegistry`, append results
4. Repeat until the LLM returns plain text or hits the budget cap
5. Return the text to the channel that asked

Surrounded by:
- **`BudgetGuard`** — per-sender daily token cap, refuses gracefully when hit
- **`HealingEngine`** — classifies errors (rate-limit, quota, bad-tool, JSON, network…) and applies one of 5 recovery tiers (retry, fallback model, simplify prompt, escape sub-loop, abort with context)
- **`ContextEngine`** — assembles the system prompt deterministically from `workspace/`
- **`SessionStore`** — SQLite-backed conversation history per `(channel, sender)` key

---

## 12. The platform (`platform/`)

The infrastructure behind `adkclaw.dev` itself — separate from the student-facing agent.

| Subdir | Stack | Role |
|--------|-------|------|
| `platform/api/` | Express + TS + Firestore + HMAC auth | Workshop API at `api.adkclaw.dev`. Receives badge webhooks from student agents, manages event codes, issues sandbox sessions. |
| `platform/frontend/` | Next.js 14 + Tailwind + TS | `adkclaw.dev` marketing site, live dashboards, region map (Phase 3 grid view → 3D Earth globe later). |
| `platform/deploy/` | `deploy-all.sh` | Single-command deploy to Cloud Run for both API and frontend. |

Auth model: **HMAC-signed webhooks** — students never log in. Their agent self-reports level completion with a signed POST; the platform records it and unlocks the next badge on the dashboard.

---

## 13. BYOK model (Bring Your Own Keys)

| Resource | Who provides | Cost |
|----------|-------------|------|
| Gemini API key | Student | Free tier covers most workshop usage |
| Telegram bot token | Student (via `@BotFather`) | Free |
| GCP project | Student (uses $300 free credits) | $0–5 across all 5 levels |
| Cloud Run deploy | Student's own project | Scales to zero, ~$0–1/mo idle |

The platform **never**:
- Stores student API keys
- Proxies their LLM calls
- Holds their data after the workshop

Each agent **survives** the workshop on the student's own Cloud Run.

---

## 14. Workshop hosting

For instructors running their own cohort:

```bash
git clone https://github.com/<your-org>/adkclaw.git
cd adkclaw
gcloud config set project YOUR_PROJECT_ID
./scripts/setup-infrastructure.sh
gcloud builds submit --config cloudbuild.yaml
./scripts/create_event.py --code "your-event-2026" --name "Your Workshop"
```

### Cost per participant (all 5 levels)

| Level | Approximate cost |
|------:|----------------:|
| 0 | $0 (no API calls) |
| 1 | ~$0.50 |
| 2 | ~$1.50 |
| 3 | ~$2.00 |
| 4 | ~$1.00 |
| **Total** | **~$5** |

Workshop platform infra: **~$60–200/year** across cohort sizes (Cloud Run scales to zero, Firestore free tier, Cloud Scheduler 3 jobs free).

---

## 15. Configuration (env vars)

After `./scripts/setup.sh`, `set_env.sh` is generated:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export REGION="us-central1"
export GEMINI_API_KEY="..."
export TELEGRAM_BOT_TOKEN="..."
export ALLOWED_SENDERS="..."   # Telegram username allowlist
```

Source before running: `source ~/adkclaw/set_env.sh`

`workshop.config.json` defaults: `gemini-2.5-pro` (with `gemini-2.5-flash` fallback), region `us-central1`, Node 22.

---

## 16. CLI

`bin/adkclaw` ships as a single command after `npm link`:

| Command | What it does |
|---------|-------------|
| `adkclaw setup` | Interactive .env wizard |
| `adkclaw start` | Run agent in foreground |
| `adkclaw bg` | Daemonise with pm2 |
| `adkclaw stop` | Stop the daemon |
| `adkclaw chat` | Terminal REPL against the running agent |
| `adkclaw open` | Open the local dashboard |

Scripts in `package.json`:

```
npm run dev        # tsx watch — fastest dev loop
npm run build      # tsc → dist/
npm run start      # node dist/index.js (production)
npm test           # vitest run (145 tests)
npm run typecheck  # tsc --noEmit
npm run setup      # tsx src/cli/setup.ts
npm run chat       # tsx src/cli/repl.ts
npm run format     # prettier --write .
```

---

## 17. Testing

145 passing Vitest tests across:

- `src/agent/` — `runner.test.ts`, `budget.test.ts`
- `src/healing/` — `classifier.test.ts`, `engine.test.ts`
- `src/memory/` — `bank.test.ts`, `daily-notes.test.ts`
- `src/multi-agent/` — `orchestrator.test.ts`
- `src/sessions/` — `store.test.ts`
- `src/skills/` — `loader.test.ts`
- `src/tools/` — `badge.test.ts`, `browser.test.ts`, `code-fix.test.ts`, `content.test.ts`, `filesystem.test.ts`, `registry.test.ts`, `shell.test.ts`
- `test/integration/` and `test/unit/`

---

## 18. Documentation index

| File | What it covers |
|------|----------------|
| [`README.md`](README.md) | Public landing page (the "what is this" entry point) |
| [`PROJECT.md`](PROJECT.md) | This document — single-page everything-about-the-project reference |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | File-by-file map for instructors (291 lines) |
| [`DEVELOPER.md`](DEVELOPER.md) | Full developer guide (623 lines) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution rules + dev setup |
| [`docs/teaching-guide.md`](docs/teaching-guide.md) | Why every architecture decision was made — for instructors (570 lines) |
| [`docs/tech-stack.md`](docs/tech-stack.md) | Google vs open-source dependencies, with rationale per package |
| [`docs/capabilities.md`](docs/capabilities.md) | What the finished agent can do — 8 wow demos |
| [`docs/api.md`](docs/api.md) | All HTTP endpoints with curl examples |
| [`docs/internals.md`](docs/internals.md) | Internal subsystems deep-dive |
| [`docs/extending.md`](docs/extending.md) | How to add a tool, a skill, a sub-agent |
| [`docs/features.md`](docs/features.md) | Feature catalogue |
| [`docs/technical-decisions.md`](docs/technical-decisions.md) | ADRs (781 lines) |
| [`docs/workshops.md`](docs/workshops.md) | Hosting playbook |
| `level_N/codelab.md` | The codelab content for level N |
| `level_N/INSTRUCTOR.md` | Run-of-show, demo script, FAQ for level N |
| `level_N/RESOURCES.md` | "If a student asks…" Q&A for level N |

---

## 19. Locked design decisions

Captured for future contributors so the same conversations don't repeat.

| Decision | Why |
|----------|-----|
| **Pure Google Cloud** (no DigitalOcean) | Pedagogical alignment: we teach Cloud Run, we use Cloud Run. GCP free tier ($0–2/mo idle) beats a DO droplet ($7+/mo always-on) at typical workshop scale. |
| **Public + private repo split** (two folders, not gitignore) | Strategy/briefs cannot leak into the public repo because they aren't in that directory tree. |
| **Style A — Cosmic Workshop** | Slate-blue tinted neutrals (`#0a0e1a`/`#131a2c`), cloud-blue accent (`#3B82F6`), gold beacons (`#facc15`). Space Grotesk + Plus Jakarta Sans + JetBrains Mono. No purple gradients, no pure black. |
| **Telegram-only v1** | WhatsApp deferred to a Phase 4 plugin system — Meta Business verification + per-message cost not worth the v1 complexity. |
| **ADK 2.0 graph framework alignment** | Old linear-chain pattern is out (Cloud Next 2026). Multi-agent orchestrator supports conditional routing + parallel execution. |
| **"Gemini Enterprise Agent Platform" branding** | Vertex AI rebrand — docs and codelabs use the new name. |
| **BYOK + HMAC-signed badge webhooks** | Students keep their keys, agents self-report completion securely. |
| **16 painterly Imagen 3 portraits** | Replaced the 12 robot SVGs (~$0.40 generation cost, Vertex AI). Single flat picker — no boys/girls UI categorisation. |
| **No AI co-author attribution** | Every commit and PR is authored solely by Ahmed. No "Generated with Claude / Anthropic / AI" footers anywhere. |
| **Submission target: Google official ADK codelabs** | Direct GDE channel to Developer Programs — Apache 2.0, claat-format ready. |

---

## 20. Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| **Phase 1 — Foundation** (May 2026, 6 weeks) | **Active** | L0+L1 content shipped, codelab/starter scaffold (45 files, 12/12 tests pass), platform API scaffolded (16 TS files), frontend Next.js scaffold next. L2/L3/L4 content + cohort-1. |
| Phase 2 — Cohort feedback + Part 2 selection | Planned | Run cohort 1, pick the most-requested Part 2 track (Coder / Researcher / Voice Tutor / Productivity Operator / Multi-Agent Orchestrator), build it. |
| Phase 3 — 3D Earth globe + Arabic | Planned | Replace grid view with Cloud Run region globe. Arabic localisation for MENA dev community. |
| Phase 4 — Plugin system + multi-tenant + skills marketplace | Planned | WhatsApp + Slack channel plugins. Skills marketplace. Multi-tenant for partner workshops. |

A **Cloud Watcher** is planned to track ADK SDK releases (`@google/genai` versions), ADK 2.0 graph framework features, A2UI/GenUI SDK updates, Gemini model version changes, and Cloud Run pricing — feeding back into codelab updates so the curriculum stays evergreen.

---

## 21. Status snapshot (May 2026)

- Public repo live with **145 passing tests, ~5,300 LOC**
- L0 + L1 student-facing docs complete (codelab.md + INSTRUCTOR.md + RESOURCES.md)
- `codelab/starter/` scaffold built, `npm install + typecheck + 12/12 tests` pass
- Platform API scaffolded (Express + Firestore + HMAC, 16 TS files)
- Frontend Next.js scaffold next
- Phase 1 ships in 6 weeks

---

## 22. License

**Apache 2.0** — see [`LICENSE`](LICENSE).

Aligns with Google's open-source pattern for ADK reference content. No restrictions on workshop hosting, derivative works, or commercial use, provided attribution is preserved.

---

## 23. Quick links

- Public repo: https://github.com/dahabit/adkclaw
- Live demo: https://adkclaw.dev
- Workshop API: https://api.adkclaw.dev
- Demo agent: https://agent.adkclaw.dev
- Codelabs (target): https://codelabs.developers.google.com/
- ADK docs: https://google.github.io/adk-docs/

---

**Author:** Ahmed Abu Eldahab — Google Developer Expert, Dart & Flutter
**Repo:** `dahabit/adkclaw` · **Apache 2.0** · **2026**
