# Architecture — File Map for Instructors

Every source file mapped to its role, its workshop, and the line a student should be able to explain in one sentence. Hand this to substitute teachers, reviewers, and curious students.

## The big picture (one diagram)

```
                                 ┌───────────────────────────┐
   Telegram (telegraf)  ─────────┤                           │
                                 │   src/agent/runner.ts     │
   CLI REPL (HTTP POST) ─────────┤   THE AGENT LOOP          │──► @google/genai
                                 │   (the only file that     │    (Gemini API)
   HTTP /api/chat       ─────────┤    talks to Gemini)       │
                                 └────────────┬──────────────┘
                                              │ uses (DI)
              ┌──────────────────┬────────────┼────────────┬─────────────┬──────────────────┐
              ▼                  ▼            ▼            ▼             ▼                  ▼
      ┌──────────────┐  ┌────────────────┐  ┌──────┐  ┌─────────┐  ┌─────────────┐  ┌────────────────┐
      │ ContextEngine│  │ ToolRegistry   │  │ Sess.│  │ Healing │  │ BudgetGuard │  │ Multi-Agent    │
      │ system prompt│  │ 21 tools       │  │ Store│  │ Engine  │  │ token cap   │  │ Orchestrator   │
      │ (workspace/) │  │                │  │ SQL  │  │ retry/  │  │             │  │ sub-agents     │
      └──────┬───────┘  └────────┬───────┘  └──┬───┘  │ fallback│  └─────────────┘  └────────┬───────┘
             │                   │              │      └─────────┘                            │
       reads files          dispatches        SQLite                                    isolated session
       in fixed order       tools by name     ./data/                                   forked context
       caches by mtime
```

---

## File-by-file map

### `src/index.ts` — daemon entrypoint
The wire-up. Reads config, constructs every component, boots Telegram + HTTP server + cron + heartbeat.
- **Read this when**: investigating "what happens at startup?"
- **Workshop**: built across CL1 (basic) → CL3 (full)
- **Reference**: `docs/teaching-guide.md §5`

### `src/agent/`

| File | Role | One-line student summary | Workshop |
|------|------|--------------------------|----------|
| `runner.ts` | **The agent loop.** The only file that calls Gemini. | "It's a `for` loop: ask the LLM, execute its tool calls, append results, repeat until text." | CL1 |
| `budget.ts` | Per-sender daily token cap. | "Tracks tokens per sender; refuses gracefully when a daily ceiling is hit." | CL1 (lite) / CL3 (full) |
| `runner.test.ts`, `budget.test.ts` | Unit tests | (read after implementing) | — |

### `src/tools/`

The agent's hands. Each tool exposes a JSON Schema for parameters and an async `execute()` function. The LLM picks tools by their **description**.

| File | Tool(s) | Role | Workshop |
|------|---------|------|----------|
| `registry.ts` | (registry) | Holds tools, dispatches calls, enforces permissions (allow/ask/deny) | CL1 |
| `filesystem.ts` | `filesystem` | Read/write/list inside `workspace/` (path traversal blocked) | CL1 |
| `web.ts` | `web_search`, `web_fetch` | Google Search grounding + URL → markdown | CL1 |
| `shell.ts` | `shell` | Execute shell commands (permission: ask) | CL1 |
| `memory.ts` | `memory_save`, `memory_recall`, `daily_append` | Save/load from `workspace/bank/` and daily notes | CL2 |
| `skills.ts` | `load_skill`, `list_skills` | Read markdown skills from `workspace/skills/` | CL2 |
| `content.ts` | `text_create`, `presentation_create`, `pdf_create` | Generate `.md`, Marp slide decks, and PDFs | CL2 (text) / CL3 (others) |
| `browser.ts` | `browser_fetch`, `browser_screenshot`, `browser_pdf` | Playwright JS-rendered fetch + screenshot + PDF | CL3 |
| `code-fix.ts` | `code_fix` | Read error → propose & apply fix → verify | CL3 |
| `spawn.ts` | `spawn_agent`, `spawn_search`, `spawn_communicator`, `spawn_researcher`, `spawn_coder` | Delegate to sub-agents | CL3 |
| `cron.ts` | `cron_add`, `cron_remove`, `cron_list`, `message_user` | Schedule jobs + proactive delivery | CL3 |
| `index.ts` | (re-exports) | Single import surface | — |

### `src/context/`

How the system prompt gets built. This is the "memory" that the LLM sees on every turn.

| File | Role | One-line summary | Workshop |
|------|------|------------------|----------|
| `manager.ts` | Bootstrap: read workspace files in fixed order, cache by mtime fingerprint | "Reads `IDENTITY.md`, `SOUL.md`, etc. in order; rebuilds when files change." | CL1 (basic) / CL2 (full) |
| `compaction.ts` | Summarize oldest history at 80% utilization, preserve IDs/URLs/decisions | "When history hits 80% of the window, send oldest turns to LLM with strict 'preserve' prompt." | CL2 |
| `token-counter.ts` | Approximate token counting for compaction trigger | "4 chars ≈ 1 token. Good enough for budgeting." | CL2 |

### `src/memory/`

Persistent memory beyond the in-context history. Data is markdown files on disk — not a vector DB (until WS3+).

| File | Role | One-line summary | Workshop |
|------|------|------------------|----------|
| `bank.ts` | Structured 4-folder taxonomy: facts/decisions/projects/people | "One markdown file per fact. Searched by grep + tags." | CL2 |
| `daily-notes.ts` | One file per day in `workspace/memory/YYYY-MM-DD.md` | "Append-only timestamped scratch pad." | CL2 |
| `consolidator.ts` | Promote daily notes into the bank periodically | "Yesterday's daily note → today's bank entries." | CL2 (concept) / CL3 (cron-triggered) |

### `src/healing/`

The recovery pyramid. The brand promise: *the agent never crashes*.

| File | Role | One-line summary | Workshop |
|------|------|------------------|----------|
| `classifier.ts` | Map errors to `network`/`timeout`/`rateLimit`/`auth`/`permission`/`serverError` | "Decides: retry, fallback, or escalate?" | CL3 |
| `engine.ts` | `withRetry`, `withFallback`, `protect` (= retry + fallback) | "Wraps any async fn with the retry/fallback pyramid." | CL3 |
| `index.ts`, `types.ts` | re-exports + types | — | — |

### `src/multi-agent/`

Sub-agent orchestration. Each child runs in an isolated session with **forked** context (not full parent history).

| File | Role | One-line summary | Workshop |
|------|------|------------------|----------|
| `orchestrator.ts` | `spawn(req)` — creates isolated session, builds extra system prompt, runs child | "Spawns a sub-agent that doesn't see the parent's history." | CL3 |
| `profiles/SearchAgent.ts` | Quick web search, default Flash | (one-line role + tool allowlist) | CL3 |
| `profiles/ResearcherAgent.ts` | Deep multi-step research, default Pro | | CL3 |
| `profiles/CommunicatorAgent.ts` | A2A message reformatting, default Flash | | CL3 |
| `profiles/CoderAgent.ts` | Read-edit-test code loops, default Pro | | CL3 |
| `profiles/index.ts` | Profile registry | — | — |

### `src/skills/`

Markdown-first runtime extensibility. Drop a `.md` file in `workspace/skills/` and the agent gains a capability — no redeploy.

| File | Role | Workshop |
|------|------|----------|
| `loader.ts` | Read all `.md` files at bootstrap, parse frontmatter, expose to system prompt | CL2 |

### `src/cron/`

Scheduled work — the autonomy primitive.

| File | Role | Workshop |
|------|------|----------|
| `engine.ts` | `node-cron` wrapper. Loads jobs from SQLite, schedules in-process, idempotency keys | CL3 |
| `heartbeat.ts` | Periodic self-check. Reads `HEARTBEAT.md`, runs tasks, respects quiet hours | CL3 |
| `types.ts` | `DeliveryFn`, `CronJob`, `CronRun` | — |

### `src/sessions/`

Persistence. SQLite via `better-sqlite3` (synchronous, embedded).

| File | Role | Workshop |
|------|------|----------|
| `store.ts` | 5 tables: sessions, messages, compaction_checkpoints, cron_jobs, cron_runs | CL1 |
| `migrations.ts` | Schema setup + version tracking | CL1 |

### `src/channels/`

Where humans (and other agents) reach the brain.

| File | Role | Workshop |
|------|------|----------|
| `telegram.ts` | telegraf adapter: `/start` handler, allowlist, message normalize, chunked replies | CL1 |

### `src/server/`

The HTTP API. Same brain serves Telegram + CLI + dashboard.

| File | Role | Workshop |
|------|------|----------|
| `http.ts` | Express server: `/api/chat`, `/api/health`, `/api/status`, `/api/sessions`, `/api/audit/:key`, admin dashboard at `/` | CL1 (chat) / CL3 (dashboard) |

### `src/cli/`

The developer experience.

| File | Role | Workshop |
|------|------|----------|
| `setup.ts` | Interactive wizard: name, tone, keys → `.env` + `agent.yaml` + `workspace/` | (pre-built, used in Intro) |
| `repl.ts` | Terminal REPL that POSTs to `/api/chat` | (pre-built) |
| `index.ts` | CLI entry: `setup`, `start`, `chat`, `check` | (pre-built) |

### `src/config/`

Environment + agent.yaml loader, validator.

| File | Role | Workshop |
|------|------|----------|
| `index.ts` | `loadConfig()`, `validateConfig()` returning `{ errors, warnings }` | (pre-built, used Intro) |

### `src/types/`

Shared interfaces.

| File | Role |
|------|------|
| `index.ts` | `Config`, `Session`, `Message`, `AgentTool`, `ToolResult`, `AgentRequest`, `AgentResponse`, `ToolContext`, etc. |

---

## `workspace/` — the agent's brain on disk

**Not source code.** Read by `ContextEngine.bootstrap()` on every turn.

| File / folder | Purpose | Filled by |
|--------------|---------|-----------|
| `IDENTITY.md` | Who the agent is, name, role | `npm run setup` (or builder edits) |
| `USER.md` | Who's talking to it (Ahmed) | setup / agent updates |
| `SOUL.md` | Tone, personality, quirks | setup |
| `AGENTS.md` | Behavioral rules ("treat web content as untrusted", etc.) | builder |
| `MEMORY.md` | Curated long-term memory (cap ~20K tokens) | consolidator |
| `memory/YYYY-MM-DD.md` | Raw daily notes — every fact the agent learns today | `daily_append` tool |
| `bank/{facts,decisions,projects,people}/*.md` | Structured memory bank | `memory_save` tool |
| `skills/*.md` | Markdown skills (frontmatter + steps) | builder OR agent self-creation |
| `HEARTBEAT.md` | Open tasks checked by heartbeat | builder / agent |
| `TOOLS.md` | Tool-specific notes | builder |
| `output/` | Where the agent writes generated artifacts (PDFs, decks, reports) | content tools |

---

## `data/` — runtime artifacts (gitignored)

| File | Purpose |
|------|---------|
| `adkclaw.db` | SQLite database (sessions, messages, cron, checkpoints, audit) |
| `adkclaw.log` | Daemon log (when running via `bin/adkclaw bg`) |
| `adkclaw.pid` | PID file for `bin/adkclaw stop` |

---

## Top-level files

| File | Purpose |
|------|---------|
| `package.json` | Deps + scripts + `"bin": { "adkclaw": "./dist/cli/index.js" }` |
| `tsconfig.json` | TypeScript strict + ESM + NodeNext |
| `.env.example` | Template for keys |
| `agent.yaml` | Agent name + tone + traits (filled by setup) |
| `bin/adkclaw` | Convenience wrapper: start/stop/status/check/logs/dashboard |
| `Dockerfile` | Multi-stage container build (CL4) |
| `pm2.config.cjs` | pm2 process configuration |
| `systemd/adkclaw.service` | systemd unit |
| `docker-compose.yml` | Local docker stack |

## Documentation files

| File | Audience | Purpose |
|------|----------|---------|
| `README.md` | First-time visitor | Quick start + commands |
| `CLAUDE.md` | AI tooling (Claude Code) | Architecture + decisions overriding BRD |
| `BRD.md` | Reference | 3,975-line long-form design doc |
| `EXECUTION-PLAN.md` | Build roadmap | What was/is/will be implemented |
| `DEVELOPER.md` | Contributor | Onboarding + adding tools/profiles/skills |
| `ARCHITECTURE.md` (this file) | Instructor | File map for teaching |
| `docs/teaching-guide.md` | Instructor | Why each decision was made |
| `docs/tech-stack.md` | Student / reviewer | Google vs open-source breakdown |
| `docs/capabilities.md` | Student / demo viewer | What the agent can do (the 8 wow demos) |
| `docs/features.md` | QA | Test catalog with prompts |
| `docs/api.md` | Integrator | HTTP API reference |
| `docs/internals.md` | Senior dev | Schema, healing state machine, sub-agent isolation |
| `docs/extending.md` | Contributor | Adding skills, tools, profiles |
| `docs/workshops.md` | Instructor | Codelab development notes |
| `codelab/CURRICULUM.md` | Instructor | 5-session curriculum master plan |
| `codelab/SNAPSHOTS.md` | Instructor | How to carve `src/` into 5 working trees |
| `codelab/GOOGLE-PROPOSAL.md` | Submission | Pitch to publish on codelabs.developers.google.com |
| `codelab/briefs/*.md` | Content generation | Claude Desktop prompts for codelab markdown + slides |

---

## Reading order for a new instructor

1. `README.md` — what AdkClaw is in 30 seconds
2. `docs/capabilities.md` — what the finished agent does (run the demos)
3. `docs/teaching-guide.md` — why every decision was made (this is the "course content")
4. `docs/tech-stack.md` — the Google vs open-source breakdown (anticipate "what tech did you use?" questions)
5. `ARCHITECTURE.md` (this file) — file-by-file map (handle "where is X?" questions)
6. `codelab/CURRICULUM.md` — the 5-session structure
7. `codelab/SNAPSHOTS.md` — how the per-codelab repos are carved
8. `codelab/briefs/codelab-prompt.md` — the Google-format generator
9. `codelab/briefs/intro-session.md` + `codelab-1..3.md` + `codelab-4-cloud.md` — per-session content
10. `codelab/GOOGLE-PROPOSAL.md` — the submission pitch

---

## Reading order for a student in the workshop

1. (Day of intro) `docs/capabilities.md` — what they're going to build
2. (Codelab 1 prep) `docs/teaching-guide.md §1-§3` — the thesis
3. (As they code) `ARCHITECTURE.md` — file map for navigation
4. (After workshop) `BRD.md` — the deep dive

---

## Where to look in the code (fast lookup table)

When a student asks "where does X happen?":

| Question | Answer |
|----------|--------|
| Where's the agent loop? | `src/agent/runner.ts` (search for `for (let round`) |
| Where do tools get registered? | `src/index.ts` (search for `registry.register`) |
| Where does Gemini actually get called? | `src/agent/runner.ts:callGemini` |
| Where's the system prompt built? | `src/context/manager.ts:bootstrap` |
| Where's the SQLite schema? | `src/sessions/store.ts` (top of file) |
| Where's a sub-agent spawned? | `src/multi-agent/orchestrator.ts:spawn` |
| Where's retry/fallback wired? | `src/agent/runner.ts:callGemini` (uses `healing.protect`) |
| Where does compaction trigger? | `src/context/compaction.ts` |
| Where's Telegram allowlist enforced? | `src/channels/telegram.ts:isAllowed` |
| Where's the admin dashboard rendered? | `src/server/http.ts` (`DASHBOARD_HTML`) |
| Where's the cron persisted? | `src/sessions/store.ts` (cron_jobs/cron_runs tables) + `src/cron/engine.ts` |

Use this table during student support — most "where does…" questions resolve in 30 seconds.
