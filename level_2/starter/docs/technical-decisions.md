# Technical Decisions — Every Tool, Every Library, Every Choice

The complete record of **what** is in AdkClaw, **why** we chose it, and **what we considered** before picking it. Read this when you want to defend (or challenge) any decision in the codebase.

> Companion doc to [`tech-stack.md`](tech-stack.md) (the quick audit). This is the deeper "why" record.

---

## Table of contents

1. [Language and runtime](#1-language-and-runtime)
2. [LLM and AI services](#2-llm-and-ai-services)
3. [Agent loop architecture](#3-agent-loop-architecture)
4. [Memory architecture](#4-memory-architecture)
5. [Tools system](#5-tools-system)
6. [Multi-agent orchestration](#6-multi-agent-orchestration)
7. [Self-healing](#7-self-healing)
8. [Channels (Telegram, CLI, HTTP)](#8-channels-telegram-cli-http)
9. [Persistence (SQLite)](#9-persistence-sqlite)
10. [Cron and heartbeat](#10-cron-and-heartbeat)
11. [Content tools](#11-content-tools)
12. [Cloud deployment](#12-cloud-deployment)
13. [Testing](#13-testing)
14. [Configuration](#14-configuration)
15. [What we deliberately rejected](#15-what-we-deliberately-rejected)

---

## 1. Language and runtime

### TypeScript 5.6+

**What it is:** strict-typed superset of JavaScript that compiles to JS.

**Why we picked it:**
- **Tool schemas are typed contracts.** When the LLM calls a tool with wrong args, we want a compile error, not a runtime crash. TypeScript catches this.
- **Single language for backend + tools + CLI + frontend.** No FFI, no marshalling, no two-language cognitive load.
- **Familiarity.** Most developers approaching agent work come from web stacks (React, Next, Vercel AI SDK) — TypeScript is the lingua franca.
- **`@google/genai` has first-class TypeScript types.** Every API surface is typed.

**What we considered:**
- **Python** — Google's other ADK target. Faster to prototype, slower at runtime, weaker types.
- **Plain JavaScript** — would have saved the `tsc` build step, but tool registration without types invites bugs.
- **Go** — fast, strict, but no `@google/genai` SDK (would need to use raw HTTP).
- **Rust** — overkill for an I/O-bound agent.

**Trade-off accepted:** the `tsc` build step adds ~3 seconds to deploys. Worth it for compile-time safety.

### Node.js 22+

**What it is:** the JavaScript runtime AdkClaw runs on.

**Why we picked it:**
- **Async-first event loop.** Agents are I/O-bound (waiting on LLM, files, HTTP) — Node's design fits perfectly.
- **`fetch` is built in** as of Node 18+. No `axios` or `node-fetch` dependency.
- **Top-level await** in ES modules — cleaner code at module load.
- **Mature ecosystem** — every npm package on Earth.
- **Cloud Run optimized** — fastest cold start of the major runtimes.

**What we considered:**
- **Bun** — faster, but native module compatibility is still spotty (especially `better-sqlite3`).
- **Deno** — first-class TypeScript, but smaller ecosystem and different conventions.

**Trade-off accepted:** Node ≥22 cuts off Node 20 users — but Cloud Shell ships Node 22, so workshop participants are fine.

### `tsx` (4.19+)

**What it is:** TypeScript runner — runs `.ts` files directly without a build step.

**Why we picked it:**
- **Hot reload in dev.** `tsx watch src/index.ts` rebuilds on file change — instant feedback.
- **No compile step in dev** — saves 3 seconds per change.
- **Drop-in for `node`** — same args, same behavior.

**What we considered:**
- **`ts-node`** — older, slower, more configuration.
- **`esbuild` + `node`** — fast but requires a build pipeline.
- **Native Node `--experimental-strip-types`** — promising, not yet stable.

### ES Modules (`"type": "module"`)

**What it is:** the modern JavaScript module system using `import`/`export`.

**Why we picked it:**
- Required by `@google/genai` (the SDK is ESM-only).
- Top-level `await` works without ceremony.
- Future-proof — CJS is being phased out across the ecosystem.

**Trade-off accepted:** all imports require `.js` extensions even from `.ts` files (`"moduleResolution": "NodeNext"` in tsconfig). Catches new students by surprise — documented in Codelab 1.

---

## 2. LLM and AI services

### `@google/genai` 1.0+ — the Agent Development Kit (ADK)

**What it is:** Google's official TypeScript SDK for Gemini and the Agent Development Kit.

**Why we picked it:**
- **First-party SDK.** Tracks the underlying API closely. No abstraction-layer drift.
- **Function calling is native.** Not bolted on — central to the API.
- **Search grounding built in.** `googleSearchRetrieval` tool is a flag, not a separate API.
- **Free tier.** Gemini API has a generous free tier (60 req/min Pro, 1500/day Flash).

**What we considered:**
- **LangChain.js** — abstracts the SDK. Hides the agent loop students need to see. **Rejected as pedagogy-killing.**
- **OpenAI SDK** — different ecosystem; would force non-Google LLM. Out of AdkClaw's scope.
- **Anthropic SDK** — same.

**Files that touch it:** **only** `src/agent/runner.ts`. Single place where Gemini is called. Everything else is wrapping logic.

### Gemini Pro (default: `gemini-3.1-pro-preview`)

**What it is:** Google's flagship multimodal LLM with 1M-token context.

**Why default model:**
- **1M-token context** — massive headroom for memory experiments
- **Strong reasoning** — handles multi-step tool plans
- **Native grounding** — Google Search built into the model
- **Multimodal** — text, images, audio

**Currency note (2026-05-08):** legacy `gemini-2.5-pro` is on a deprecation path with Oct 16, 2026 shutdown. New builds pin `gemini-3.1-pro-preview`.

### Gemini Flash (default: `gemini-3-flash-preview`)

**What it is:** the smaller, faster, cheaper sibling.

**Why fallback model + sub-agent default:**
- **~10× cheaper** than Pro
- **Faster** — lower latency for simple tasks
- **Sufficient** for specialized sub-agents (search, single-tool work)
- **Used as Pro's fallback** when Pro returns 5xx

**Currency note (2026-05-08):** legacy `gemini-2.5-flash` follows the same Oct 16, 2026 deprecation; new builds pin `gemini-3-flash-preview`. The voice-tutor extension uses `gemini-3.1-flash-live-preview` for the bidirectional Live API.

**HealingEngine pattern:** primary call uses Pro, on retryable error falls back to Flash. Students rarely notice the swap.

### Vertex AI (`@google-cloud/aiplatform` — Level 4)

**What it is:** Google Cloud's enterprise AI platform.

**What we use it for:**
- **Embeddings** (`gemini-embedding-001`) — semantic search over memory bank
- **Vector Search** — when bank > 10K entries, SQLite cosine search graduates here
- **Cloud-mode Gemini** — when running in Cloud Run, use Vertex over Gemini API for IAM integration

**Why two SDK paths:**
- Local dev: Gemini API (simpler, free tier)
- Production: Vertex AI (IAM, audit logs, regional control)

**Set via env:** `GOOGLE_GENAI_USE_VERTEXAI=True` switches the SDK.

---

## 3. Agent loop architecture

### The `for` loop pattern (BRD §6.1)

**What it is:** `for (let round = 0; round < MAX_TOOL_ROUNDS; round++) { call → execute tools → repeat }`

**Why a `for`/`while` loop, not a graph:**
- **Simple to teach.** Students see the loop, not magic.
- **No graph compiler** like LangGraph requires.
- **Deterministic.** No "this state machine has 47 nodes" complexity.
- **Cancellable.** Bail out early when the LLM produces text.

**What we considered:**
- **LangGraph** — directed graphs of agent nodes. Powerful, opaque. Hides the loop.
- **CrewAI** — task-based crews. Higher-level abstraction. Same critique.
- **State machines** — overkill for a 5-line loop.

**MAX_TOOL_ROUNDS = 15:** circuit breaker against runaway tool loops. Empirically: real agent tasks rarely need >8 rounds. 15 gives headroom; >15 is a bug.

### Function calling (`tools: [{ functionDeclarations: [...] }]`)

**What it is:** Gemini's native mechanism for "the LLM decides which function to call."

**How it works:**
1. We pass `functionDeclarations` (name, description, JSON Schema) to Gemini
2. Gemini returns either `text` or `functionCalls[]`
3. We execute each call, append `functionResponse` parts, loop

**Why this over text-parsing patterns (ReAct, etc.):**
- **Native** — LLM is trained to use it, lower hallucination rate
- **Typed** — JSON Schema validates args before execution
- **Structured** — no regex parsing of "Action: foo[bar]"

**Critical invariant:** description is the LLM's only signal for tool selection. Bad description → wrong tool. We document this explicitly in Codelab 1.

### Streaming (NOT used by default)

**What we considered:** Gemini supports `generateContentStream` for token-by-token streaming.

**Why we skip it:**
- Telegram doesn't support partial-message updates well (you'd have to chunk + edit)
- CLI REPL can stream, but the value is small for a 2-second response
- Adds significant complexity for marginal UX benefit

**When to add it:** if/when AdkClaw gets a true web chat UI (not currently planned).

---

## 4. Memory architecture

### Three-tier memory model (BRD §6.4)

```
In-context history → Daily notes (raw) → Memory bank (structured)
                                                     ↓
                                           (when full) Compaction
```

**Why three tiers, not one or two:**
- **One tier (just history):** runs out of context, forgets everything older
- **Two tiers (history + bank):** you'd dump every fact into the bank — bloat
- **Three tiers:** raw events stay raw (daily notes), curated facts get promoted (bank), context window stays manageable (compaction)

Two independent production agent systems converged on this pattern — strong empirical signal. Adopt.

### File-based memory (markdown files in `workspace/`)

**What it is:** the agent's memory lives as markdown files on disk, not in a database.

**Why files:**
- **Auditable** — `cat workspace/MEMORY.md` shows you the agent's mind
- **Versionable** — `git diff` shows what the agent learned this week
- **Portable** — `cp -r workspace/ backup/` is your backup
- **Editable mid-conversation** — change a file, mtime invalidates cache, agent picks it up next turn

**What we considered:**
- **Postgres + pgvector** — overkill for single-host. Graduates path in Level 4 if scale demands.
- **Redis** — fast, but ephemeral. Not the agent's "long-term mind."
- **Vector DB only** — fast retrieval but opaque. You can't `cat` a Pinecone collection.
- **JSON files** — would work, but markdown wins on human-readable + LLM-friendly.

### Memory bank taxonomy (4 folders)

```
workspace/bank/
├── facts/        ← static knowledge (e.g. "user prefers TypeScript")
├── decisions/    ← past choices with rationale (e.g. "picked SQLite over Postgres")
├── projects/     ← active work threads
└── people/       ← who's who (collaborators, contacts)
```

**Why exactly four:**
- These are the four categories that actually came up in real agent usage
- More categories = harder for the LLM to pick the right one
- Fewer = bloat in one bucket

**Pattern provenance:** validated in production agent systems for 2+ years.

### Compaction at 80% (BRD §6.4 + §19)

**What it is:** when history hits 80% of the model's context window, summarize the oldest turns into a single summary message.

**Why 80%, not 95%:**
- The LLM needs **headroom** to GENERATE the summary
- At 95%, the summary itself runs out of tokens mid-generation
- 80% leaves 200K tokens free on a 1M window — plenty

**What gets preserved in the summary:**
- IDs (issue numbers, file paths, URLs)
- Decisions made (with rationale)
- Task status (in-progress, blocked, done)
- Key facts the user shared

**Pattern provenance:** empirically validated threshold across multiple production systems.

### Mtime-based cache invalidation

**What it is:** the system prompt is cached; cache key is the aggregate mtime of all workspace files we read.

**Why:**
- Reading 7 files on every turn adds ~10ms — wasteful
- But files DO change (live edits, agent self-edits via tools)
- Solution: cache + check mtime fingerprint at start of every turn

**Pattern:** `fingerprint = files.map(f => f.mtimeMs).join('|')`. If cached fingerprint matches, return cached prompt; else rebuild.

**What we considered:** `fs.watch` with debounce. More efficient, but more complex. Mtime-on-bootstrap is good enough.

---

## 5. Tools system

### `AgentTool` interface

```typescript
interface AgentTool {
  name: string;
  description: string;       // The LLM's only signal for tool selection!
  permission: 'allow' | 'ask' | 'deny';
  parameters: object;        // JSON Schema
  fallbackToolName?: string;
  execute(args, ctx): Promise<ToolResult>;
}
```

**Why this exact shape:**
- **`name`** — required by Gemini's `functionDeclarations`
- **`description`** — required + critical for selection (taught in CL1)
- **`permission`** — three tiers because two (allow/deny) is too binary; "ask" = human-in-the-loop
- **`parameters`** — JSON Schema is what Gemini validates against
- **`fallbackToolName`** — when this tool fails (browser crash), fall back to alternative (web_fetch)
- **`execute`** — the only async operation; ToolContext gives access to session, logger

### Permission tiers (`allow` / `ask` / `deny`)

**What they mean:**
- **allow** — execute immediately (web_search, filesystem-read)
- **ask** — execute only after user approval (filesystem-write, shell, browser)
- **deny** — never executes (anything destructive)

**Why three, not two:**
- **`ask`** is the killer. It's **the human-in-the-loop pattern** — production agents will encounter situations where the *right* call isn't obvious
- In v1, `ask` auto-approves with a console warning (single-user trust model)
- In production, `ask` becomes a UI prompt (web/Telegram/Slack)

**Pattern provenance:** convergent permission-model + approval-gate design from production agent systems.

### 21 tools registered

| Category | Tools | Files |
|----------|-------|-------|
| Web | `web_search`, `web_fetch` | `src/tools/web.ts` |
| Browser | `browser_fetch`, `browser_screenshot`, `browser_pdf` | `src/tools/browser.ts` |
| Filesystem | `filesystem` | `src/tools/filesystem.ts` |
| Shell | `shell` | `src/tools/shell.ts` |
| Memory | `memory_save`, `memory_recall`, `daily_append` | `src/tools/memory.ts` |
| Skills | `load_skill`, `list_skills` | `src/tools/skills.ts` |
| Content | `text_create`, `presentation_create`, `pdf_create` | `src/tools/content.ts` |
| Code | `code_fix` | `src/tools/code-fix.ts` |
| Spawn | `spawn_agent`, `spawn_search`, `spawn_communicator`, `spawn_researcher`, `spawn_coder` | `src/tools/spawn.ts` |
| Cron | `cron_add`, `cron_remove`, `cron_list`, `message_user` | `src/tools/cron.ts` |

**Why this exact set:**
- **Web**: an agent without web is a chatbot
- **Browser** (Playwright): JS-rendered pages, screenshots, page-to-PDF
- **Filesystem**: writing files (reports, drafts) + reading workspace
- **Shell**: escape hatch for "just run this command"
- **Memory**: the bank + daily notes (CL2 spine)
- **Skills**: runtime extensibility (CL2 wow moment)
- **Content**: agents that produce artifacts beat agents that only chat
- **Code-fix**: the "self-improving" demo
- **Spawn**: multi-agent (CL3)
- **Cron**: autonomy (CL3)

---

## 6. Multi-agent orchestration

### Sub-agents fork context, never share it (BRD §6.8)

**The discipline (NON-NEGOTIABLE):**
1. Sub-agent gets its own SQLite session row (`kind='isolated'`, `parent_key` set)
2. Sub-agent gets identity + workspace memory via `ContextEngine.bootstrap()`
3. Sub-agent does NOT see parent's conversation history — ever
4. Sub-agent gets the task + goal ancestry as an extra system prompt slice

**Why this is critical:**
- Passing full history → tokens explode (parent + child + grandchild = exponential)
- Passing full history → parent's secrets/decisions leak to children
- Passing full history → child confused about its own role

**Pattern provenance:** convergent enforcement across multiple production agent systems.

### 4 specialized profiles (Search, Researcher, Communicator, Coder)

**Why named profiles + generic spawn:**
- **Named profiles** are a richer mental model than "one generic agent"
- Each profile = bootstrap snippet + default model + tool allowlist + role
- Students learn "spawn a researcher" feels different from "spawn a coder"
- **Generic `spawn_agent`** stays for ad-hoc tasks

| Profile | Default model | Why |
|---------|--------------|-----|
| SearchAgent | Flash | Quick web fact-finding doesn't need Pro |
| ResearcherAgent | Pro | Multi-step research benefits from reasoning |
| CommunicatorAgent | Flash | A2A reformatting is structural, not creative |
| CoderAgent | Pro | Code reasoning benefits from Pro |

### Goal ancestry (`goalChain: string[]`)

**What it is:** chain from the highest-level mission down to the immediate task, passed to every sub-agent.

**Pattern provenance:** "goal ancestry" pattern from production agent systems.

**Why:**
- Sub-agent knows *why* it's working, not just *what*
- Better-aligned outputs (the child can prioritize per the original mission)
- Audit trail — every action traces back to a top-level goal

---

## 7. Self-healing

### The recovery pyramid (BRD §12)

```
   ESCALATE   ↑ surface a clear message to the user
    DEGRADE   ↑ continue with reduced capability
     RECOVER  ↑ restart subsystem (channel, cron)
     FALLBACK ↑ swap primary for alternative
   RETRY      ↑ exponential backoff
```

**Why this exact pyramid:**
- Each tier is independent and observable in logs
- Caller can pick which tiers apply (some operations have no fallback)
- Echoes the "let it crash" recovery philosophy from process-supervisor designs, but with explicit tiers instead of supervisor trees

### Error classification (`src/healing/classifier.ts`)

**Categories:**
- `network` — retry
- `timeout` — retry
- `rateLimit` — retry with longer backoff
- `serverError` (5xx) — retry, then fallback
- `auth` / `permission` — **escalate immediately**
- `invalidInput` — escalate (don't retry)
- `crash` — recover (subsystem restart)

**Why classify before retrying:**
- Auth errors don't recover from retry — they escalate
- Naive "always retry" wastes API quota and burns time

### Exponential backoff (1s → 2s → 4s)

**Why exponential:**
- Doubling spreads load when many clients hit a rate limit simultaneously
- Cap at 8s — beyond that, cumulative wait > user patience

**Pattern source:** standard distributed-systems wisdom (Google SRE book, AWS guidelines).

### Pro → Flash fallback

**Why this specific fallback:**
- 5xx on Pro often means the Pro endpoint is overloaded
- Flash is a separate endpoint; less correlated failures
- Quality drop is measurable but acceptable for the recovery moment

---

## 8. Channels (Telegram, CLI, HTTP)

### Telegraf 4.16+ (Telegram bot)

**What it is:** typed wrapper around Telegram's Bot API.

**Why over raw Bot API:**
- ~150 LOC adapter vs ~400 LOC raw HTTP polling
- Typed message handlers (`bot.on('message', ...)`)
- Built-in support for both long-polling and webhook modes (Level 4 switch)
- Active maintenance, good TypeScript support

**What we considered:**
- **`grammy`** — modern alternative to telegraf. Smaller bundle. Same idea.
- **Raw `node-telegram-bot-api`** — older, less typed.

### Telegram-specific patterns

**The `/start` self-discovery pattern:**
- New users send `/start` → bot replies with their numeric ID
- They add ID to `ALLOWED_SENDERS` → restart → they can chat
- **Solves a real student-facing bug** — they used to set username instead of numeric ID

**Allowlist filter:**
- Telegram is a public network — anyone can message a bot
- Allowlist by numeric ID is the simplest auth
- Future: replace with Cloud Run auth + Telegram auth bridge

**Webhook (Level 4) vs long-polling (CL1-3):**
- Long-polling works locally and in Cloud Shell
- Webhook is required for Cloud Run (free tier scales to zero)
- The codelab teaches the switch

### Express 4.21 (HTTP server)

**What it is:** the most familiar Node HTTP framework.

**Why Express over Fastify, NestJS, Koa:**
- **Most familiar to most developers** — 90% of Node devs have used it
- Sufficient performance for our endpoints (10-100 RPS workshop traffic)
- Smaller cognitive load than NestJS (no decorators, no DI container)
- `express.json()` + error handler is all the middleware we need

**What we considered:**
- **Fastify** — 2× faster, similar API. Not worth the cognitive switch.
- **NestJS** — too much abstraction. Hides what we teach.
- **Koa** — middleware-first, but Express is good enough.
- **Bun.serve** — locks us to Bun runtime.

### Terminal CLI (`adkclaw chat`)

**What it is:** thin REPL that POSTs to `/api/chat` over localhost.

**Why this design:**
- One agent runtime serves Telegram + CLI + HTTP
- Same memory, same brain, different interfaces
- Students can demo over `npm run chat` without Telegram setup

---

## 9. Persistence (SQLite)

### `better-sqlite3` 11.3+

**What it is:** synchronous SQLite bindings for Node.

**Why SQLite over Postgres / MySQL / Redis:**
- **Embedded** — no separate server process, zero-config
- **Atomic writes** — ACID transactions out of the box
- **File-based** — `cp data/adkclaw.db backup.db` is your backup
- **Production-grade for single-host** — handles 10K writes/sec easily

**Why synchronous (controversial):**
- Async DB drivers force you to `await` every read in the hot path
- For agent state, **atomicity matters more than throughput**
- Synchronous keeps the agent loop readable
- WAL mode (default) gives concurrent reader support

**What we considered:**
- **Postgres** — overkill for v1, single-host. Level 4 swap path documented.
- **Redis** — fast but ephemeral. Wrong shape for "session history."
- **DynamoDB** — schemaless, scales infinitely. AWS lock-in.
- **Firestore** — exactly what Level 4 swaps to for cloud-mode.

### Schema (5 tables)

```sql
sessions             -- one per conversation thread
messages             -- append-only message log (per session)
compaction_checkpoints -- audit trail for what was summarized
cron_jobs            -- persistent schedule
cron_runs            -- append-only fired-job log (idempotency)
```

**Why exactly these:**
- `sessions` + `messages` are the agent's conversation state — must persist
- `compaction_checkpoints` is the audit trail (BRD §6.4) — required for "what did the agent forget?"
- `cron_jobs` + `cron_runs` are autonomous-mode state — must survive restart

**Indexes:** composite on `(session_key, created_at)` for message ordering. UNIQUE on `cron_runs.idempotency_key`.

---

## 10. Cron and heartbeat

### `node-cron` 3.0+

**What it is:** cron-syntax scheduler running in-process.

**Why over alternatives:**
- **Persistent jobs in SQLite** — survive daemon restart
- **In-process timer** is sufficient locally; Level 4 swaps to Cloud Scheduler
- **Cron syntax** familiar to most developers

**What we considered:**
- **`bull` / `bullmq`** — Redis-backed queues. Overkill for cron.
- **Cloud Scheduler from day one** — locks Levels 1-3 to GCP. We want them runnable in Cloud Shell.

### Idempotency keys (`<jobId>:<floor(ms/60000)>`)

**What it is:** UNIQUE constraint on `cron_runs(idempotency_key)`.

**Why:**
- If daemon was down at 09:00 and starts at 09:01, `node-cron` "catches up" by firing missed ticks
- Without dedup, the missed tick double-fires
- Minute-bucket key prevents this — same minute = same key = INSERT fails silently

**Pattern provenance:** Cloud Scheduler's idempotency model + atomic-execution patterns from production agent systems.

### Heartbeat (every 30 min)

**What it is:** periodic self-check that reads `HEARTBEAT.md`, looks for tasks, pings user about open items.

**Why:**
- Agent that only reacts isn't autonomous
- Heartbeat gives the agent a "tick" to think between user turns
- Reads `HEARTBEAT.md` (open tasks) — file-based, students can `cat` to debug

**Quiet hours (22:00 - 07:00):**
- Hard rule: no pings during quiet hours unless `urgent: true`
- Students learn this as a real-world constraint

---

## 11. Content tools

### Playwright 1.59+ (browser automation)

**What it is:** Microsoft-maintained browser-control library.

**Why over Puppeteer:**
- Multi-browser (Chromium, Firefox, WebKit) — Puppeteer is Chrome-only
- Built-in auto-wait — fewer flakey tests
- More active maintenance
- Better TypeScript support

**Use cases:**
- `browser_fetch` — JS-rendered pages
- `browser_screenshot` — visual capture
- `browser_pdf` — `page.pdf()` for HTML → PDF

**Container size hit:** ~500MB Playwright base image for Cloud Run. Documented in Level 4.

### `pdfkit` 0.18+ (programmatic PDFs)

**What it is:** pure-JS PDF builder.

**Why both Playwright and pdfkit:**
- Playwright: HTML → PDF (rendered output)
- pdfkit: programmatic layout (no browser needed)
- Pdfkit is ~200KB; Playwright is ~500MB

**When to use which:**
- Playwright: when source is HTML/Markdown that should render
- pdfkit: when source is structured data (tables, charts) and a browser is overkill

### `@marp-team/marp-cli` (slide decks)

**What it is:** Markdown → HTML/PDF/PPTX slide deck generator.

**Why Marp:**
- Slide deck = single markdown file (versionable, editable)
- One command renders to multiple formats
- The `presentation_create` tool produces real conference-quality decks

### `sharp` (image processing)

**What it is:** native bindings for libvips — fast image resize/crop/format conversion.

**Why:**
- When the agent generates images (Imagen), it needs to resize for delivery
- Pure JS alternatives are 10-50× slower
- Production-ready for Cloud Run

---

## 12. Cloud deployment (Level 4)

### Cloud Run

**What it is:** Google Cloud's managed serverless container platform.

**Why over alternatives:**
- **Serverless** — scales to zero (free tier covers most workshops)
- **Container-based** — you control the runtime exactly
- **Auto-restart** on crash — even rare hard crashes self-heal
- **Custom domain mapping** — `agent.adkclaw.dev` works
- **HTTPS by default** — Let's Encrypt auto-provisioned

**What we considered:**
- **Cloud Functions** — stateless, doesn't fit a long-lived daemon
- **GKE** — overkill, ops burden
- **Compute Engine VMs** — old-school, manual ops

### Firestore (Level 4 — replaces SQLite)

**What it is:** Google Cloud's schemaless document DB.

**Why for cloud-mode:**
- **Global** — read/write from any region
- **Pay-per-op** — free tier covers small workshops
- **Real-time updates** — perfect for the live dashboard
- **No schema migrations** — flexible during early development

**Trade-off:** more expensive per-op than SQLite (which is free). Cap reads with pagination.

### Secret Manager

**What it is:** Google's KMS for secrets.

**Why over `.env` in production:**
- Secrets versioned (rollback if rotated key breaks something)
- IAM-controlled access (audit who reads what)
- Rotation support
- Cloud Run native integration: `--set-secrets=GEMINI_API_KEY=gemini-api-key:latest`

### Cloud Scheduler (replaces node-cron in cloud)

**What it is:** managed cron-as-a-service.

**Why over node-cron in cloud:**
- Cloud Run scales to zero — no in-process timer to fire
- Cloud Scheduler triggers an HTTP endpoint at scheduled times
- 3 jobs free; $0.10/job/month after

### Cloud Storage (replaces local `workspace/`)

**What it is:** S3-equivalent object storage.

**Why for cloud-mode:**
- Cloud Run instances are ephemeral — local files don't survive
- GCS FUSE mounts a bucket as a directory in the container
- Or: SDK adapter for explicit reads/writes

---

## 13. Testing

### Vitest 2.1+

**What it is:** Vite-powered test runner.

**Why over Jest:**
- 2-3× faster cold start
- Native ESM (no `babel-jest` shenanigans)
- Compatible Jest API (easy migration if needed)
- Built-in TypeScript support

**Coverage target:** 145+ tests covering ~5,300 LOC. We test **behavior**, not lines.

### Test categories

| Category | What we test | What we skip |
|----------|--------------|--------------|
| **Unit tests** | Pure logic (compaction, classifier, registry, healing pyramid) | LLM calls (mocked) |
| **Integration tests** | Real workspace files, real SQLite | Real network calls |
| **Type tests** | Compile-time invariants via `tsc --noEmit` | Runtime type checks |

**What we deliberately skip:**
- **Real LLM calls** — flaky, costs money, slow
- **Telegram E2E** — manual smoke test in workshop demos
- **Browser tests** — Playwright is itself the browser; we mock it for unit tests

---

## 14. Configuration

### `.env` + `agent.yaml` (twin config files)

**Why two files, not one:**
- **`.env`** — secrets (API keys, allowlist) — gitignored
- **`agent.yaml`** — non-secret runtime config (name, tone) — gitignored (per-user)
- **Separation** prevents accidentally committing secrets

**`.env` covers:** `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ALLOWED_SENDERS`, `DEFAULT_MODEL`, `FALLBACK_MODEL`, `MAX_TOOL_ROUNDS`, `COMPACTION_THRESHOLD`, `HEARTBEAT_INTERVAL_MS`, `TIMEZONE`, `DAILY_TOKEN_BUDGET`, `PORT`, `HOST`.

**`agent.yaml` covers:** `name`, `tone`, `traits`.

**Why YAML for `agent.yaml`:**
- More human-readable than JSON for multi-line traits
- Comments allowed
- Standard for "config files"

### Validation in `validateConfig()`

Returns `{ errors, warnings }` (post-fix from earlier session — the chicken-and-egg `ALLOWED_SENDERS` issue).

**Errors block startup.** Warnings allow startup with reduced functionality.

---

## 15. What we deliberately rejected

| Tech | Why rejected |
|------|-------------|
| **LangChain / LangGraph / CrewAI** | Frameworks hide the agent loop students need to see. We teach the loop directly. |
| **MCP (Model Context Protocol)** | Tool-discovery standard. Out of scope for v1 — we register tools explicitly so wiring is visible. |
| **Postgres / pgvector (in core)** | Overkill for single-host. Level 4 mentions it as the multi-tenant graduation path. |
| **Redis / RabbitMQ / Kafka** | Single-user agent doesn't need a message queue. SQLite append-only tables play that role. |
| **Webpack / Rollup / Vite (for backend)** | Server-side TypeScript compiles directly with `tsc`. No bundler in the path. |
| **Docker (in dev)** | Level 4 introduces it. Locally, native Node is faster to iterate. |
| **Auth0 / Firebase Auth / Cognito** | Single-user agent. Telegram allowlist + sender ID is sufficient. Multi-tenant is future work. |
| **Datadog / New Relic / Sentry** | Cloud Logging + admin dashboard suffice. SaaS adds ops complexity. |
| **GraphQL** | REST is simpler for our 6-endpoint API. GraphQL would be 50+ lines of overhead per endpoint. |
| **gRPC** | Not human-debuggable from `curl`. REST + JSON keeps the wire format inspectable. |
| **`axios` / `node-fetch`** | Node 22 has built-in `fetch`. No reason to add a dependency. |
| **`lodash` / `ramda`** | Modern JS has `.map`, `.filter`, `.flat`, structured cloning. No utility lib needed. |
| **Class-based components / OOP-heavy** | Functional + dependency injection is enough. Inheritance hierarchies add cost without benefit at this scale. |

---

## How to use this document

- **Before adding a dependency**: search this doc for similar choices. If we rejected an alternative, understand why before re-adopting.
- **Before refactoring an architecture pattern**: read the relevant section. Most patterns have a "what we considered" subsection — your alternative may already be in there.
- **When teaching**: each section maps to a workshop concept. Use the "why" answers as ammunition for student questions.
- **When proposing a change**: write your decision in the same shape. **What it is**, **why we'd pick it**, **what we'd consider**, **trade-off accepted**.

This document is the project's **canonical source of truth** for "why is X this way?" When you change architecture, update this doc in the same PR.
