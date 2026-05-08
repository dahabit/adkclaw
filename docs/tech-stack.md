# Tech Stack Audit — What's Google, What Isn't, and Why

Students always ask: *"Did you use anything besides Google ADK?"* Here's the honest answer, dependency by dependency, with the reasoning. **Every** non-Google package was a deliberate teaching trade-off, not an accident.

---

## TL;DR

| Layer | Provider | Could-replace-with-Google? |
|-------|----------|---------------------------|
| **LLM** | **Google** — `@google/genai` (ADK + Gemini) | — |
| **Web search grounding** | **Google** — built into Gemini | — |
| **Embeddings** (WS3) | **Google** — Vertex AI `gemini-embedding-2` (multimodal) or `gemini-embedding-001` (text-only legacy) | — |
| **Vector search** (WS3) | **Google** — Vertex AI Vector Search | — |
| HTTP server | Express (open source) | Yes — Cloud Run native handlers |
| Telegram bot | telegraf (open source) | Cloud Functions webhook |
| Database | better-sqlite3 (open source) | Cloud Firestore / Cloud SQL (Workshop 4) |
| Cron scheduler | node-cron (open source) | Cloud Scheduler (Workshop 4) |
| Browser automation | Playwright (Microsoft) | None equivalent at Google |
| PDF generation | pdfkit (open source) | None equivalent at Google |
| Image processing | sharp (open source) | None equivalent at Google |
| Slide generation | Marp CLI (open source) | None equivalent at Google |
| External code AI | Gemini CLI (Google, shell-invoked) | — |
| Configuration | dotenv, yaml (open source) | Cloud Secret Manager (Workshop 4) |
| Test runner | vitest (open source) | None — testing is local |

**The agent's brain is 100% Google.** Everything else is open-source plumbing that connects the brain to the world. Workshop 4 (cloud) replaces the operational pieces (DB, cron, secrets, hosting) with their Google Cloud equivalents.

### Model + SDK currency (verified 2026-05-08)

| Pin | Current value | Notes |
|---|---|---|
| `@google/genai` | `^2.0.0` | Official JS SDK; the legacy `@google/generative-ai` package is EOL |
| Default Pro model | `gemini-3.1-pro-preview` | Replaces `gemini-2.5-pro` (deprecates Oct 16, 2026) |
| Default Flash model | `gemini-3-flash-preview` | Replaces `gemini-2.5-flash` (deprecates Oct 16, 2026) |
| Live API (voice) | `gemini-3.1-flash-live-preview` | Used in the voice-tutor extension; `callbacks` parameter is required |
| Embeddings | `gemini-embedding-2` (multimodal) or `gemini-embedding-001` (text-only legacy) | `text-embedding-004` is deprecated as of Jan 2026 |

If you're running a cohort *before* the Oct 16, 2026 cutoff, `gemini-2.5-pro/flash` will still work — but new projects should pin the 3.x replacements above to avoid mid-cohort breakage.

---

## The Google stack (the brain)

### `@google/genai` — Google ADK for TypeScript

**What it is**: the official Google SDK for the Agent Development Kit. Single npm package that handles:
- `GoogleGenAI` client construction
- `models.generateContent({...})` — sync request/response
- `models.generateContentStream({...})` — streaming
- Function calling (the foundation of tools)
- Built-in `googleSearchRetrieval` tool (grounding)
- `countTokens` helper

**Why we picked it**: it's the source of truth for Gemini integration. The TypeScript bindings track the underlying API closely. No abstraction layer to argue with.

**Where it lives**: `node_modules/@google/genai/`

**Files that touch it**: `src/agent/runner.ts` (the only place we call `client.models.generateContent`).

### Gemini models

- **Default**: `gemini-3.1-pro-preview` — 1M-token context, strong reasoning, built-in grounding
- **Fallback**: `gemini-3-flash-preview` — much cheaper, fast, used for sub-agents and 5xx fallback
- **Live API (voice extension)**: `gemini-3.1-flash-live-preview`
- **Embeddings**: `gemini-embedding-2` (multimodal) or `gemini-embedding-001` (text-only legacy)

### Vertex AI (Workshop 3)

Embeddings + Vector Search for semantic recall. Optional in v1; introduced when memory bank outgrows SQLite cosine similarity.

---

## The non-Google stack (and why we're using it)

### `express` — HTTP server

- **What it is**: the most familiar Node.js HTTP framework.
- **Why not write raw `http.createServer`?** Express middleware (`json()`, error handlers) saves ~80 lines per route.
- **Why not Fastify, NestJS, Koa?** Express is what 90% of Node devs already know. Teaching Fastify would distract from agent concepts.
- **Cloud-native equivalent**: Cloud Run accepts any HTTP server. Express runs unchanged.

### `telegraf` — Telegram bot framework

- **What it is**: a typed Telegram Bot API wrapper.
- **Why not raw Bot API?** ~150 LOC of telegraf vs ~400 LOC of raw HTTP polling. Plus typed message handlers.
- **Cloud-native?** Telegraf supports both **long polling** (what we use locally — daemon polls Telegram) and **webhook mode** (Telegram POSTs to our HTTPS endpoint, used in Cloud Run). Workshop 4 switches modes.

### `better-sqlite3` — embedded database

- **What it is**: synchronous SQLite bindings for Node.
- **Why SQLite?** Embedded (no separate server), zero-config (`npm install` and you have a database), perfect for single-host agents.
- **Why synchronous?** Node devs flinch at "sync I/O", but for agent state mutations we want **atomic writes** without juggling promises. The agent's hot path doesn't need to scale to 10K rps.
- **Cloud-native swap (Workshop 4)**: **Cloud Firestore** for global multi-region read/write, OR **Cloud SQL (Postgres)** for relational queries with pgvector for embeddings.

### `node-cron` — scheduling

- **What it is**: cron-syntax scheduler running in-process.
- **Why?** Schedules persist in our SQLite (with idempotency keys), but the *firing* needs an in-process timer when running locally.
- **Cloud-native swap (Workshop 4)**: **Cloud Scheduler** triggers an HTTP endpoint on our Cloud Run service. Removes the in-process timer entirely. The job rows still persist in Firestore.

### `playwright` — browser automation

- **What it is**: Microsoft-maintained browser-control library.
- **Why?** JS-rendered pages, screenshots, `page.pdf()` for HTML→PDF.
- **Why not puppeteer?** Playwright supports Chromium, Firefox, WebKit, has built-in auto-wait, and is more actively maintained.
- **Cloud-native?** Cloud Run supports Playwright **only with a custom container** that includes the browser binaries (~500 MB image). Workshop 4 covers the Dockerfile change.

### `pdfkit` — programmatic PDFs

- **What it is**: pure-JS PDF builder.
- **Why?** Lightweight (~200 KB), no headless browser required for simple programmatic PDFs.
- **Why not just Playwright `page.pdf()`?** When you don't have HTML, you don't want to spin up a browser to render it. Pdfkit lets the agent write a PDF in 50 lines without rendering.
- **Cloud-native?** Pure JS — runs anywhere.

### `sharp` — image processing

- **What it is**: high-performance image resize / format conversion.
- **Why?** When the agent generates images (via Imagen, future workshop), it needs to resize/crop for delivery.
- **Cloud-native?** Pure native module, runs in Cloud Run with the right Docker base image.

### `@marp-team/marp-cli` — slide deck generator

- **What it is**: Markdown → HTML/PDF/PPTX slide deck.
- **Why?** Lets the agent produce conference-quality decks from a single markdown file. Used by `presentation_create` tool.
- **Cloud-native?** CLI — runs in any container with Node.

### `dotenv`, `yaml`, `node-cron` — small utilities

- **`dotenv`**: load `.env` into `process.env`. Cloud-native swap: read from **Cloud Secret Manager** in Workshop 4.
- **`yaml`**: parse `agent.yaml`. Stays as-is on cloud.
- (node-cron covered above.)

### `vitest` — test runner

- **What it is**: Vite-powered Vitest.
- **Why not Jest?** Faster cold start, native ESM, less config.
- **Cloud-native?** Tests run locally and in CI, never in production.

### Gemini CLI — invoked via `child_process`

- **Not an npm dep** — it's a separate CLI students install with `npm install -g @google/gemini-cli` (or similar).
- **Why?** The `code_fix` tool shells out to `gemini -p "..."` for model-driven code edits. Keeps the binary out of the agent's npm tree.
- **Cloud-native?** Skip on cloud — `code_fix` falls back to direct Gemini API calls.

---

## What's intentionally NOT in the stack

These are the things students often expect to see but we deliberately omitted:

| Not used | Why |
|----------|-----|
| **LangChain / LangGraph / CrewAI** | Frameworks hide the agent loop. We teach the loop directly so students understand what's happening at every step. |
| **MCP (Model Context Protocol)** | Tool-discovery standard. Out of scope for v1 — we register tools explicitly. Documented as future work. |
| **Redis / RabbitMQ / Kafka** | Single-user agent doesn't need a message queue. SQLite append-only tables play that role. |
| **Postgres / pgvector** | Overkill for v1. Workshop 4 mentions it as the graduation path for multi-tenant. |
| **Webpack / Rollup / Vite** | Server-side TypeScript compiles directly with `tsc`. No bundler in the path. |
| **Docker (in dev)** | Workshop 4 introduces it for cloud. Locally, native Node is faster to iterate. |
| **Auth0 / Firebase Auth / Cognito** | Single-user agent. Telegram allowlist + sender ID is sufficient. Multi-tenant is future work. |
| **Monitoring SaaS (Datadog / New Relic / Sentry)** | Workshop 4 uses Cloud Logging + the built-in admin dashboard. SaaS adds ops complexity that distracts from agent concepts. |

---

## Dependency graph (what depends on what)

```
@google/genai
       │
       ▼
src/agent/runner.ts ◄──── src/healing/engine.ts
       │                          │
       ├─► src/context/manager.ts (file reads only)
       ├─► src/tools/registry.ts ─► individual tools
       │     ├─► filesystem.ts (fs)
       │     ├─► web.ts (fetch — built-in fetch in Node 22+)
       │     ├─► browser.ts ─► playwright
       │     ├─► content.ts ─► pdfkit, marp-cli
       │     ├─► code-fix.ts ─► child_process (gemini CLI)
       │     ├─► memory.ts ─► src/memory/bank.ts (fs)
       │     ├─► skills.ts ─► src/skills/loader.ts (fs)
       │     ├─► spawn.ts ─► src/multi-agent/orchestrator.ts
       │     └─► cron.ts ─► src/cron/engine.ts ─► node-cron
       └─► src/sessions/store.ts ─► better-sqlite3

src/channels/telegram.ts ─► telegraf ─► AgentRunner
src/server/http.ts ─► express ─► AgentRunner
src/cli/* ─► AgentRunner (via HTTP for chat REPL)
src/config/* ─► dotenv, yaml
```

**Dependency depth**: 3 levels max. **Total npm deps**: 11 production + 7 dev = 18. Target was <20.

---

## Cloud equivalents (what changes in Workshop 4)

| Local | Cloud (Workshop 4) |
|-------|-------------------|
| `.env` via `dotenv` | **Secret Manager** mounted as env vars |
| `data/adkclaw.db` (SQLite) | **Firestore** (sessions/messages/cron) OR **Cloud SQL** (Postgres + pgvector for embeddings) |
| `workspace/` (local files) | **Cloud Storage bucket** mounted at `/workspace` (FUSE) — or read/write via SDK |
| `node-cron` (in-process timer) | **Cloud Scheduler** → HTTPS endpoint on Cloud Run |
| `bot.launch()` (long polling) | **Telegram webhook** → POST to Cloud Run `/api/telegram` |
| `pm2` / `systemd` (process supervisor) | **Cloud Run** (managed, auto-restart, auto-scale) |
| Local logs (stdout) | **Cloud Logging** (queryable, retained) |
| Local admin dashboard | Same dashboard, exposed via Cloud Run public URL |

The agent's **brain** (the loop, the tools, the prompts) stays unchanged. Only the **operational shell** moves to Google Cloud.

---

## Summary for students

> **The brain is Google. The plumbing is open source. Workshop 4 swaps the plumbing for Google Cloud equivalents — same brain, cloud-grade ops.**

This is why we picked TypeScript + Node.js: every layer is replaceable, observable, and teachable. Hosted frameworks would have hidden too much.
