author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community)
summary: Spawn isolated sub-agents with forked context. Build the five-tier recovery pyramid that turns "the agent never crashes" into a design constraint. Add cron with idempotency keys and a heartbeat loop with quiet hours. End with a live admin dashboard.
id: adkclaw-codelab-3-agent-army
categories: ai,ml,gemini,adk,typescript,nodejs,agents,multi-agent,resilience
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 3 — The Agent Army

## Before you begin

In Level 2 your agent gained persistent memory and runtime extensibility. Today it gains **a team and a backbone**: specialised sub-agents to delegate to, a five-tier recovery pyramid that prevents crashes, cron jobs that survive restart, and a heartbeat that respects when you're sleeping. This is **Level 3 of 5** in the AdkClaw series.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites

- Completed [Level 2 — Memory & Skills](https://github.com/dahabit/adkclaw/tree/main/level_2)
- Working agent with persistent memory + skills
- Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- A working terminal and editor

### What you will learn

- **Sub-agent orchestration** — isolated sessions, forked context (the non-negotiable), goal ancestry
- **Specialised profiles** — Search (Flash), Researcher (Pro), Communicator (Flash), Coder (Pro)
- **Tool allowlists per profile** — each sub-agent sees only the tools it needs
- The **recovery pyramid** — Retry → Fallback → Recover → Degrade → Escalate
- **Error classification** — retryable vs non-retryable, with rate-limit headers honoured
- **Exponential backoff** — 1s → 2s → 4s, capped, with jitter
- **Cron with idempotency keys** — `<jobId>:<floor(ms/60000)>` prevents missed-tick double-fires
- **Heartbeat with quiet hours** — periodic self-check that respects 22:00–07:00
- **Admin dashboard** — live HTML status at `/`, auto-refreshing

### What you will need

- A computer with **Node.js 22+** installed
- The Level 2 codebase (yours, or fast-forward via `git checkout v2-complete -- codelab/starter/`)
- A free [Gemini API key](https://aistudio.google.com/apikey) (already in `.env`)
- A [Telegram bot token](https://t.me/BotFather) (already in `.env`)
- A handful of Gemini Pro + Flash testing turns — comfortably inside the free tier

## Introduction

A single agent is a tool. **Many agents collaborating is a system.** The leap matters because the moment you delegate, three new problems appear:

1. **Context pollution** — if a sub-agent inherits the parent's full conversation history, you double the tokens, leak unrelated context, and confuse the child about its role.
2. **Failure cascade** — if the sub-agent crashes, does the parent crash too? When does a child's error escalate? When does it recover silently?
3. **Long-running work** — what about jobs that take ten minutes? The parent's Telegram session times out before the sub-agent returns.

The orchestrator pattern solves the first. The recovery pyramid solves the second. The cron + heartbeat pair solves the third.

By the end of this level, you can ask the agent: *"Every weekday at 9 AM, search Google ADK news, and ping me only if something new shipped."* It will: schedule the cron, persist it to disk so it survives restart, dedupe missed-tick double-fires with idempotency keys, fork a Researcher sub-agent on each fire, route through the recovery pyramid if Gemini is rate-limited, and message you on Telegram only when there's a delta worth knowing about.

That's not a chatbot. That's a colleague.

### What you will build

By the end of this codelab, you will have:

- A `MultiAgentOrchestrator` that spawns isolated sub-agents with forked context
- Four specialised profiles (`SearchAgent`, `ResearcherAgent`, `CommunicatorAgent`, `CoderAgent`)
- A `HealingEngine` with `withRetry()`, `withFallback()`, `protect()` primitives
- An error `classifyError()` function that maps any error to a retry decision
- A `CronEngine` that loads jobs from SQLite, schedules via `node-cron`, and dedupes via idempotency keys
- A `Heartbeat` loop with quiet hours
- An admin dashboard at `localhost:3000/` (auto-refreshing HTML)
- Five new tools on the agent: `spawn_search`, `spawn_researcher`, `spawn_communicator`, `spawn_coder`, plus generic `spawn_agent`
- Three more tools: `cron_add`, `cron_remove`, `cron_list`
- A passing `npm test` (~110 tests across the new modules)

## 1. Branch and verify

```bash
cd ~/adkclaw/codelab/starter   # or your L2 directory
source ~/adkclaw/set_env.sh
git checkout -b level-3
npm test         # all L2 tests must still pass
npm run typecheck
```

The L3 work layers four new modules on top of L2. If L2 is broken, L3 will be uninterpretable.

> **Verified reference.** The complete, compiling Level 3 starter is tagged
> `v3-complete`. `git checkout v3-complete -- codelab/starter/` gives the exact
> end state of this level (`npm run build` + `npm run typecheck` clean, 114
> tests passing); `git diff v2-complete v3-complete -- codelab/starter/` is the
> precise implementation diff. Where a snippet below is abbreviated for
> teaching, the tagged starter is the source of truth.

## 2. Sub-agent orchestration

A sub-agent is **a fresh runner invocation with a different system prompt and a smaller toolset**, in its own session, returning a structured result.

### The six rules of disciplined sub-agents

1. **ISOLATED SESSION** — its own SQLite session row, `kind='isolated'`, linked to the parent via `parent_key`. The child persists independently — a parent crash does not destroy the child's work.
2. **FORKED CONTEXT (NON-NEGOTIABLE)** — the sub-agent does NOT see the parent's conversation history. It inherits identity + workspace memory (via `ContextEngine.bootstrap()`), and gets the **task + goal ancestry** as an extra system prompt slice.
3. **RESTRICTED TOOL ALLOWLIST** — each profile declares which tools it may use. The runner enforces the allowlist when it builds function declarations for Gemini.
4. **CHEAPER MODEL BY DEFAULT** — profiles default to Gemini Flash (10x cheaper than Pro). Only Researcher and Coder escalate to Pro.
5. **CAPPED ROUNDS, ENFORCED TIMEOUT** — each profile has its own `MAX_TOOL_ROUNDS` (lower than the parent's). The caller wraps `spawn()` in a timeout.
6. **AUTO-ARCHIVE ON COMPLETION** — child sessions are archived after `spawn()` returns so they don't clutter the dashboard.

Why is rule 2 non-negotiable? If you pass parent history to children:
- **Tokens explode** — every spawn doubles your context cost
- **Secrets leak** — a Researcher sub-agent reads the user's other unrelated messages
- **Children get confused** — "wait, am I the parent or am I the parent's research helper?"

> **What "forked context" actually means (be precise):** sub-agents have **isolated message history** (their own session row, no parent messages) but **share the workspace** (same `IDENTITY.md`, same memory bank, same skills directory). The isolation is at the **session** level, not the **knowledge** level. This is intentional — the agent team shares long-term knowledge but not conversation context.
>
> **Anti-pattern (don't do this):**
>
> ```typescript
> // ❌ WRONG — leaks parent's unrelated conversation into the child
> const result = await this.runner.run({
>   sessionKey: childKey,
>   message: req.task,
>   history: parentHistory,   // never pass this
> });
> ```
>
> **Correct (the runner should refuse parent history for `kind='isolated'` sessions):**
>
> ```typescript
> // ✅ RIGHT — child starts with empty messages, gets workspace + extra prompt
> const result = await this.runner.run({
>   sessionKey: childKey,        // SessionStore returns [] for new isolated session
>   message: req.task,
>   extraSystemPrompt,           // identity (workspace) + role + goal ancestry
>   allowedToolNames,
> });
> ```

### Implement `src/multi-agent/orchestrator.ts`

```typescript
// src/multi-agent/orchestrator.ts
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';
import { PROFILES, type AgentProfile } from './profiles/index.js';

export interface SpawnRequest {
  task: string;
  parentSessionKey: string;
  profileId?: string;
  goalChain?: string[];
  model?: string;
}

export interface SpawnResult {
  ok: boolean;
  summary: string;
  toolCalls: number;
  tokensUsed: number;
  durationMs: number;
  childSessionKey: string;
  profileId: string | null;
  error?: string;
}

export interface OrchestratorOptions {
  runner: AgentRunner;
  sessions: SessionStore;
  contextEngine: ContextEngine;
  config: Config;
}

function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class MultiAgentOrchestrator {
  private readonly runner: AgentRunner;
  private readonly sessions: SessionStore;
  private readonly contextEngine: ContextEngine;
  private readonly config: Config;

  constructor(opts: OrchestratorOptions) {
    this.runner = opts.runner;
    this.sessions = opts.sessions;
    this.contextEngine = opts.contextEngine;
    this.config = opts.config;
  }

  resolveProfile(profileId: string | undefined): AgentProfile | null {
    if (!profileId) return null;
    return PROFILES[profileId] ?? null;
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    const start = Date.now();
    const profile = this.resolveProfile(req.profileId);
    const childKey = `subagent:${req.parentSessionKey}:${randomKey()}`;
    const model = this.modelFor(profile, req.model);

    // Isolated session — its own row, linked to the parent, no shared history.
    const session = this.sessions.ensureSession(
      childKey,
      'subagent',
      null,
      model,
      'isolated',
      req.parentSessionKey,
    );

    const framing =
      '[You are a sub-agent spawned for ONE specific task. Complete it and return a ' +
      'structured result. Do not chitchat. Do not chain into unrelated work.]';
    const profileText = profile
      ? `\n\n## Your role\n${profile.role}.\nReports to: ${profile.reportsTo}.\n\n${profile.bootstrap}`
      : '';
    const goalText =
      req.goalChain && req.goalChain.length > 0
        ? '\n\n## Goal ancestry (why this matters)\n' +
          req.goalChain.map((g, i) => `${i + 1}. ${g}`).join('\n')
        : '';

    // Forked context: workspace identity/memory + the sub-agent slice — but
    // NOT the parent's conversation history (history: []).
    const systemPrompt = `${this.contextEngine.bootstrap().systemPrompt}\n\n---\n\n${framing}${profileText}${goalText}`;

    try {
      const result = await this.runner.run({
        session,
        systemPrompt,
        history: [],
        userText: req.task,
        ...(profile ? { allowedToolNames: profile.toolAllowlist } : {}),
      });
      return {
        ok: true,
        summary: result.reply,
        toolCalls: result.toolCalls,
        tokensUsed: 0,
        durationMs: Date.now() - start,
        childSessionKey: childKey,
        profileId: profile?.id ?? null,
      };
    } catch (e) {
      return {
        ok: false,
        summary: '',
        toolCalls: 0,
        tokensUsed: 0,
        durationMs: Date.now() - start,
        childSessionKey: childKey,
        profileId: profile?.id ?? null,
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      this.sessions.archiveSession(childKey);
    }
  }

  private modelFor(profile: AgentProfile | null, override: string | undefined): string {
    if (override) return override;
    if (profile?.defaultModel === 'pro') return this.config.gemini.defaultModel;
    return this.config.gemini.fallbackModel;
  }
}
```

### The four profiles

```typescript
// src/multi-agent/profiles/SearchAgent.ts
export const SearchAgent: AgentProfile = {
  id: 'search',
  role: 'A focused search specialist',
  reportsTo: 'parent agent',
  bootstrap: 'You take a search query and return the top 3 most relevant results with citations.',
  defaultModel: 'flash',
  toolAllowlist: ['web_search', 'web_fetch'],
  maxToolRounds: 5,
};
```

| Profile | File | Tools allowed | Default model | Max rounds |
|---------|------|---------------|---------------|------------|
| `SearchAgent` | `profiles/SearchAgent.ts` | `web_search`, `web_fetch` | Flash | 5 |
| `ResearcherAgent` | `profiles/ResearcherAgent.ts` | `web_search`, `web_fetch`, `memory_*`, `spawn_search` | Pro | 10 |
| `CommunicatorAgent` | `profiles/CommunicatorAgent.ts` | `message_user` only | Flash | 3 |
| `CoderAgent` | `profiles/CoderAgent.ts` | `filesystem`, `shell`, `code_fix` | Pro | 8 |

### Wire the spawn tools

In `src/index.ts`, after constructing the orchestrator:

```typescript
const orchestrator = new MultiAgentOrchestrator({ runner, sessions, config });
registry.register(makeSpawnAgentTool(orchestrator));
registry.register(makeSpawnSearchTool(orchestrator));
registry.register(makeSpawnCommunicatorTool(orchestrator));
registry.register(makeSpawnResearcherTool(orchestrator));
registry.register(makeSpawnCoderTool(orchestrator));
```

### Test it

```bash
npm test src/multi-agent/orchestrator.test.ts
```

Tests verify forked context (parent history not in child), allowlist enforcement, archive-on-completion, and timeout cancellation.

> **Common pitfall**: students sometimes pass the parent's conversation history into the sub-agent's `extraSystemPrompt`. Don't. Identity + task + goal ancestry only.

## 3. The recovery pyramid

The brand promise of an autonomous agent: **it never crashes.** That's not "rarely crashes" — that's **never**. To honour the promise you need an explicit, layered recovery strategy:

```
                          ESCALATE   ↑ surface a clear message to the user
                            DEGRADE  ↑ continue with reduced capability
                              RECOVER  ↑ restart subsystem (channel/cron level)
                              FALLBACK ↑ Pro → Flash, browser → web_fetch
                              RETRY    ↑ exponential backoff for transient errors
```

Read bottom-up: try the cheap recovery first, escalate only when nothing else works.

> **What we ship in L3 vs aspirational layers:**
>
> | Layer | L3 status | Where it lives |
> |------|-----------|----------------|
> | **RETRY** | Shipped — `HealingEngine.withRetry()` | `src/healing/engine.ts` |
> | **FALLBACK** | Shipped — `HealingEngine.withFallback()` and `protect()` | `src/healing/engine.ts` |
> | **RECOVER** | Per-subsystem (Telegram reconnect, cron re-arm), not in `HealingEngine` | `src/channels/telegram.ts`, `src/cron/engine.ts` |
> | **DEGRADE** | Caller's responsibility — pattern shown in `runner.ts` ("answer from training data only" branch) | `src/agent/runner.ts` |
> | **ESCALATE** | Caller's responsibility — surface a clear message via the channel | runner + channel |
>
> Layers 1–2 are proper primitives in `HealingEngine`. Layers 3–5 are **patterns** the runner and adapters apply themselves. We teach all five so the vocabulary is shared, but only Retry + Fallback have a unit-testable surface today. A future iteration may promote Recover/Degrade into the engine.

### Step 1 — classify the error

Implement `src/healing/classifier.ts`:

```typescript
export function classifyError(err: unknown): ClassifiedError {
  const e = err as { message?: unknown; status?: unknown; code?: unknown; name?: unknown };
  const message = typeof e.message === 'string' ? e.message : JSON.stringify(err);
  const lower = message.toLowerCase();
  const status = typeof e.status === 'number' ? e.status : undefined;
  const code = typeof e.code === 'string' ? e.code : undefined;

  // 401/403 → auth — never retry
  if (status === 401 || /api[\s_-]?key|unauthorized/.test(lower))
    return { type: 'auth', message, retryable: false, status: status ?? 401 };
  if (status === 403 || /forbidden|permission/.test(lower))
    return { type: 'permission', message, retryable: false, status: status ?? 403 };

  // 429 → rate limit — retry, honour Retry-After
  if (status === 429 || /rate[\s_-]?limit|quota/.test(lower)) {
    const retryAfterMs = parseRetryAfter(message);
    return { type: 'rateLimit', message, retryable: true, retryAfterMs, status: status ?? 429 };
  }

  // 5xx → server — retry
  if (status !== undefined && status >= 500)
    return { type: 'serverError', message, retryable: true, status };

  // Network / timeout — retry
  if (code === 'ENOTFOUND' || code === 'ECONNRESET' || /network|timeout/.test(lower))
    return { type: 'network', message, retryable: true };

  return { type: 'unknown', message, retryable: false };
}
```

Auth and permission errors are **non-retryable** — they don't get better with time. Rate-limit, 5xx, network, and timeout **are retryable**.

### Step 2 — retry with exponential backoff

```typescript
async withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const max = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const cap = opts.maxDelayMs ?? 8000;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const classified = classifyError(e);
      if (!classified.retryable || attempt === max) throw e;
      const expBackoff = Math.min(base * 2 ** (attempt - 1), cap);
      const waitMs = classified.retryAfterMs ?? expBackoff;
      opts.onRetry?.({ attempt, error: classified, waitMs });
      await sleep(waitMs);
    }
  }
  throw lastErr;
}
```

Sequence: 1s → 2s → 4s → (8s cap). The exponent is `2^(attempt-1)`. If the server returns `Retry-After`, honour it instead of the exponential calculation.

### Step 3 — fallback when retries are exhausted

```typescript
async withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, opts: FallbackOptions = {}) {
  try {
    const result = await primary();
    return { result, usedFallback: false };
  } catch (e) {
    const classified = classifyError(e);
    const skip = opts.skipFallbackFor ?? ['auth', 'permission'];
    if (skip.includes(classified.type)) throw e;
    opts.onFallback?.({ error: classified });
    const result = await fallback();
    return { result, usedFallback: true, error: classified };
  }
}
```

Auth errors **skip fallback** — switching from Pro to Flash doesn't fix a bad API key. Network errors fall back to a degraded mode (e.g., answer from training data only).

### Step 4 — combine into `protect()`

```typescript
async protect<T>(primary: () => Promise<T>, fallback: () => Promise<T>, opts: RetryOptions & FallbackOptions = {}) {
  return this.withFallback(() => this.withRetry(primary, opts), fallback, opts);
}
```

The runner wraps every Gemini call in `protect()`:

```typescript
const { result, usedFallback } = await healing.protect(
  () => client.models.generateContent({ model: 'gemini-3.1-pro-preview', contents }),
  () => client.models.generateContent({ model: 'gemini-3-flash-preview', contents }),
  { maxAttempts: 3 },
);
```

### Test it

```bash
npm test src/healing/
```

Tests cover: retryable vs non-retryable classification, `Retry-After` parsing, exponential backoff timing, fallback skip-list, and `protect()` end-to-end.

> **Common pitfall**: students sometimes retry **everything** (including auth errors). Walk the classifier table — auth and permission errors are dead ends.

## 4. Cron with idempotency keys

A cron job that fires twice for the same minute (because two daemons restarted at the same time) is a recurring nightmare. The fix is small: **dedupe by minute**.

### Implement `src/cron/engine.ts`

```typescript
export class CronEngine {
  private readonly tasks = new Map<string, ScheduledTask>();

  start() {
    const jobs = this.db.prepare('SELECT * FROM cron_jobs WHERE active=1').all() as CronJob[];
    for (const job of jobs) this.schedule(job);
  }

  schedule(job: CronJob) {
    const task = nodeCron.schedule(job.schedule, async () => {
      const idempotencyKey = `${job.id}:${Math.floor(Date.now() / 60000)}`;
      try {
        this.db
          .prepare('INSERT INTO cron_runs (job_id, idempotency_key, fired_at) VALUES (?, ?, ?)')
          .run(job.id, idempotencyKey, Date.now());
      } catch (e: any) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return; // dedup hit, skip silently
        throw e;
      }
      try {
        await this.fire(job);
      } catch (err) {
        await this.markFailed(job.id, idempotencyKey, err);
      }
    }, { timezone: this.tz });
    this.tasks.set(job.id, task);
  }
}
```

The trick is the `UNIQUE` constraint on `(job_id, idempotency_key)`. Two daemons firing at the same minute both try to INSERT — one wins, one gets `SQLITE_CONSTRAINT_UNIQUE` and skips silently.

The minute floor is your tolerance: if your cron has minute granularity, dedupe on minutes. For second-level cron, use seconds. Don't go finer than your cron expression.

### Wire the cron tools

```typescript
registry.register(makeCronAddTool(cronEngine));
registry.register(makeCronRemoveTool(cronEngine));
registry.register(makeCronListTool(cronEngine));
registry.register(makeMessageUserTool(delivery));
```

The `delivery` function dispatches by channel:

```typescript
const delivery: DeliveryFn = async (channel, target, text) => {
  if (channel === 'telegram' && telegram) {
    await telegram.deliver(target, text);
    return;
  }
  console.log(`[delivery:${channel}:${target}] ${text}`);
};
```

### Test it

```bash
npm test src/cron/
```

Tests verify: persisted jobs survive restart, idempotency dedupe, and `cron_runs` table appends.

> **Common pitfall**: students forget the UNIQUE constraint and end up with double-fires when the daemon restarts mid-minute.

## 5. Heartbeat with quiet hours

The cron engine is **scheduled** work. The heartbeat is **periodic** work — every 30 minutes (or whatever you configure), the agent checks `HEARTBEAT.md` and decides whether to act on any open tasks.

### The respect-the-user constraint

If the heartbeat fires at 3 AM, the user gets a Telegram ping. That's not autonomous; that's annoying. Quiet hours block delivery between 22:00 and 07:00 local time:

```typescript
export class Heartbeat {
  start() {
    this.interval = setInterval(() => this.tick(), this.intervalMs);
  }

  private async tick() {
    const hour = new Date().getHours();
    const { start, end } = this.quietHours;
    const inQuiet = (start < end && hour >= start && hour < end) ||
                    (start > end && (hour >= start || hour < end));
    if (inQuiet) return; // skip silently — user is asleep

    const heartbeatPath = resolve(this.workspacePath, 'HEARTBEAT.md');
    if (!existsSync(heartbeatPath)) return;
    const content = await readFile(heartbeatPath, 'utf8');
    if (!content.includes('OPEN:')) return; // nothing to do

    await this.runner.run({
      sessionKey: this.sessionKey,
      message: '[heartbeat tick] Check HEARTBEAT.md for open tasks. Act on any that are due.',
    });
  }
}
```

The agent gets a turn every 30 minutes during work hours. If it has open tasks, it works. If it doesn't, it's a no-op.

### Test it

```bash
npm test src/cron/heartbeat.test.ts
```

Tests verify: quiet-hours skip, no-action when HEARTBEAT.md is empty, runner invocation when tasks are present.

## 6. The admin dashboard

`localhost:3000/` should show a live HTML status page with:

- Active sessions (count + last-message timestamps)
- Tokens used today
- Channel breakdown (telegram / cli / http)
- Active sub-agent spawns
- Cron jobs (next fire times)
- Recent compactions

### Implement in `src/server/http.ts`

```typescript
const DASHBOARD_HTML = `<!doctype html>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="5" />
<title>AdkClaw — Dashboard</title>
<style>
  body { font-family: 'Plus Jakarta Sans', system-ui; background: #0a0e1a; color: #e2e8f0; padding: 2rem; }
  .card { background: #131a2c; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  h1, h2 { font-family: 'Space Grotesk', system-ui; }
  .pill { background: #3B82F6; color: white; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
</style>
<h1>AdkClaw — Dashboard</h1>
<div class="card"><h2>Sessions</h2><pre id="sessions"></pre></div>
<div class="card"><h2>Tokens today</h2><pre id="tokens"></pre></div>
<div class="card"><h2>Cron</h2><pre id="cron"></pre></div>
<script>
  fetch('/api/admin/status').then(r => r.json()).then(s => {
    document.getElementById('sessions').textContent = JSON.stringify(s.sessions, null, 2);
    document.getElementById('tokens').textContent = s.tokensToday;
    document.getElementById('cron').textContent = JSON.stringify(s.cron, null, 2);
  });
</script>`;

app.get('/', (_req, res) => res.send(DASHBOARD_HTML));
app.get('/api/admin/status', (_req, res) => res.json(buildStatusPayload(...)));
```

`bin/adkclaw open` opens this in your browser.

> **Why HTML, not React?** The dashboard refreshes every 5 seconds. There's no interactivity to manage. A static HTML page is one HTTP request, no build step, no bundle. **Defer the complexity until simple breaks.**

## 7. The wow demos

Three demos, in order. They build on each other.

### Demo 1 — Sub-agent delegation

```
You: Research Google ADK in depth and save findings to my bank.
Bot: Spawning ResearcherAgent...
     [9 tool calls later — web_search x2, web_fetch x4, memory_save x3]
     ✓ Saved 4 facts to bank/facts/. Summary attached.
```

The parent received structured results back. The child never confused itself with the parent.

### Demo 2 — Recovery pyramid (live)

Pull your network mid-conversation:

```bash
$ ifconfig en0 down  # macOS
```

On Telegram:

```
You: What is the current Flutter version?
[1s wait] retry...
[2s wait] retry...
[4s wait] retry...
[fallback Pro → Flash]
[Flash also fails — escalate]
Bot: I can't reach the web right now. Last I knew, Flutter 3.27 was stable.
```

```bash
$ ifconfig en0 up
```

```
You: What is the current Flutter version?
Bot: Flutter 3.30 stable as of [date]. (web_search)
```

### Demo 3 — Cron survives restart

```
You: Every weekday at 9 AM, search Google ADK news. Ping me only if something new shipped.
Bot: Scheduled. Job ID: cron_a8f2.
```

```bash
$ sqlite3 data/adkclaw.db "SELECT * FROM cron_jobs;"
# shows persisted job
$ bin/adkclaw stop
$ bin/adkclaw bg
# next 9 AM — fires autonomously, even though you restarted in between
```

### Demo 4 — Live dashboard

```bash
$ bin/adkclaw open
# Browser opens http://localhost:3000/
# Live: sessions, tokens, cron jobs, sub-agent activity, all auto-refreshing
```

## 8. Light up your Level 3 badge

**Trigger**: a sub-agent successfully spawns AND returns a non-error result (any of `spawn_search` / `spawn_researcher` / `spawn_communicator` / `spawn_coder` / generic `spawn_agent`).

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox), your third pillar lights up on the fleet view.

## What you have now

Your single agent has become **a system**:

- A team of four specialised sub-agents to delegate to
- A recovery pyramid that turns every transient error into a no-op
- Cron jobs that survive restart and dedupe missed-tick double-fires
- A heartbeat that respects when you're sleeping
- A dashboard for observing all of it

You can ask it to do something tomorrow at 9 AM, close your laptop, and trust that it will. That's the test of autonomy.

## What's next

Level 4 ships your agent to **Google Cloud** so it survives losing your laptop. Containerise, migrate state to Firestore, switch Telegram to webhook mode, schedule cron via Cloud Scheduler, and deploy to Cloud Run. Your agent gets a public HTTPS URL and you can throw your laptop in a lake.

[Continue to Level 4 — Ship to the Cloud →](https://github.com/dahabit/adkclaw/tree/main/level_4)

---

## Appendix A — Files you touched

| File | Role | What you implemented |
|------|------|----------------------|
| `src/multi-agent/orchestrator.ts` | Spawn isolated sub-agents | `spawn()`, `spawnParallel()`, `resolveProfile()` |
| `src/multi-agent/profiles/SearchAgent.ts` | Search profile | Definition + tool allowlist |
| `src/multi-agent/profiles/ResearcherAgent.ts` | Researcher profile | Definition + tool allowlist |
| `src/multi-agent/profiles/CommunicatorAgent.ts` | Communicator profile | Definition + tool allowlist |
| `src/multi-agent/profiles/CoderAgent.ts` | Coder profile | Definition + tool allowlist |
| `src/healing/classifier.ts` | Classify errors | `classifyError()` |
| `src/healing/engine.ts` | Recovery primitives | `withRetry()`, `withFallback()`, `protect()` |
| `src/cron/engine.ts` | Persistent cron | `start()`, `schedule()`, idempotency keys |
| `src/cron/heartbeat.ts` | Periodic heartbeat | `start()`, `tick()`, quiet hours |
| `src/server/http.ts` | Admin dashboard | `DASHBOARD_HTML` + `/api/admin/status` |
| `src/tools/spawn.ts` | Spawn tools | `makeSpawnSearchTool`, etc. |
| `src/tools/cron.ts` | Cron tools | `makeCronAddTool`, etc. |

## Appendix B — Troubleshooting

| Issue | Fix |
|-------|-----|
| Sub-agent hangs forever | Add `timeoutMs` to `spawn()` — 60s default is reasonable. |
| Auth errors retry instead of escalating | `classifyError()` missing `auth` in skip list. Verify the 401 branch. |
| Cron job double-fires after restart | `(job_id, idempotency_key)` UNIQUE constraint missing in `cron_runs`. |
| Heartbeat fires at 3 AM | Quiet-hours check inverted. The condition is `inQuiet === true` → return. |
| Dashboard empty | The `/api/admin/status` endpoint isn't wired or the `<script>` fetch URL is wrong. |
| Sub-agent uses parent tools it shouldn't | `toolAllowlist` not enforced. Check `runner.run()` filters function declarations by allowlist. |

## Appendix C — Where each concept lives in the production code

- **Goal ancestry chain** — full hierarchical chain in `src/multi-agent/profiles/index.ts`
- **Cron run audit** — `cron_runs` table in `src/sessions/store.ts` migration
- **Dashboard real-time** — production version uses SSE (`/api/admin/stream`), not polling. See `src/server/http.ts` full
- **Healing telemetry** — production logs `usedFallback` to Cloud Logging in L4
