# AdkClaw — Developer Guide

Everything you need to understand, extend, and debug the reference implementation.

- [Prerequisites](#prerequisites)
- [Project layout](#project-layout)
- [Running locally](#running-locally)
- [The agent loop](#the-agent-loop)
- [Adding a tool](#adding-a-tool)
- [Adding a sub-agent profile](#adding-a-sub-agent-profile)
- [Teaching the agent a new skill](#teaching-the-agent-a-new-skill)
- [Memory system](#memory-system)
- [Self-healing engine](#self-healing-engine)
- [Configuration reference](#configuration-reference)
- [Testing guide](#testing-guide)
- [Debugging](#debugging)
- [Architecture decisions](#architecture-decisions)

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | ≥ 22 | Runtime |
| npm | ≥ 10 | Package manager |
| Gemini API key | — | AI backend |
| Telegram bot token | — | Telegram channel |
| Playwright Chromium (optional) | — | Browser tools |

```bash
node --version    # expect v22+
npm --version     # expect 10+
```

---

## Project layout

```
src/
├── index.ts                  # daemon entry point — wires everything together
├── types/                    # shared TypeScript interfaces
│   ├── agent.ts              # AgentRequest, AgentResponse, FinishReason
│   ├── session.ts            # Session, Message
│   └── tool.ts               # AgentTool, ToolContext, ToolPermission
│
├── config/                   # config loader (dotenv + YAML → Config object)
├── sessions/                 # SQLite store (sessions, messages, compaction, cron)
├── context/                  # ContextEngine: bootstrap, compaction, token-counter
├── agent/                    # AgentRunner (loop), BudgetGuard
├── healing/                  # HealingEngine, error classifier
├── multi-agent/              # Orchestrator + profiles/
├── memory/                   # MemoryBank, DailyNotes, Consolidator
├── skills/                   # markdown skill file loader
├── cron/                     # CronEngine, Heartbeat
├── tools/                    # all 25 registered tools
├── channels/telegram.ts      # Telegraf adapter
├── server/http.ts            # Express routes
└── cli/
    ├── setup.ts              # interactive setup wizard
    └── repl.ts               # terminal REPL client
```

Key non-source files:

| File | Purpose |
|------|---------|
| `workspace.example/` | Template the setup wizard copies into `workspace/` |
| `workspace/` | Runtime memory — identity, notes, skills, memory bank |
| `data/adkclaw.db` | SQLite database (gitignored) |
| `codelab/` | Workshop starter + per-step snapshots |
| `.env` | Secrets (gitignored; created by `npm run setup`) |

---

## Running locally

```bash
# First time
npm install
npm run setup         # interactive — creates .env + workspace/

# Development (hot-reload)
npm run dev

# In a second terminal
npm run chat          # terminal REPL → connects to :3000

# Tests
npm test              # all 144 tests
npm test -- src/tools/content.test.ts    # single file
npm test -- -t "browser_fetch"           # single test by name

# Production build
npm run build && node dist/index.js
```

The daemon logs every turn to stdout. On startup it prints the active config, model names, workspace path, and HTTP port.

---

## The agent loop

`AgentRunner.run(req)` is the heart of the system. Here is the exact flow:

```
run(AgentRequest)
  │
  ├─ 1. getOrCreateSession(key, channel, target, senderId)
  ├─ 2. BudgetGuard.check(senderId)      ← refuse immediately if over daily cap
  ├─ 3. ContextEngine.bootstrap()        ← assemble system prompt (cached by mtime)
  ├─ 4. SessionStore.listMessages()      ← build conversation history
  ├─ 5. Filter tool declarations by allowedToolNames (if set — used by sub-agent profiles)
  │
  └─ Loop (up to MAX_TOOL_ROUNDS):
       ├─ callGemini(model, contents, systemInstruction, sdkTools)
       │    └─ HealingEngine.protect(primary, fallback) ← retry + model fallback
       │
       ├─ If response has no function calls:
       │    └─ append assistant message → break → return AgentResponse
       │
       └─ If response has function calls:
            ├─ For each call: ToolRegistry.execute(name, args, ctx)
            ├─ Append tool messages to session store
            └─ Append function responses to contents → loop
```

**Key invariants:**
- Every user message and every assistant reply is persisted before the next call to Gemini.
- Tool calls are persisted even when the loop doesn't produce a final text reply.
- `finishReason: 'max_rounds'` is returned when the loop exhausts its budget. This is not an error — the agent simply didn't converge.
- All errors go through `HealingEngine` when wired up. The runner itself never crashes — it returns `finishReason: 'error'` with `error` field set.

**Contents array convention:**

Gemini expects an alternating `user / model` structure. The runner builds this from the session's message history on every turn:

```
user:  "what is the weather?"
model: [function call: web_search]
user:  [function response: { result: "..." }]
model: "The weather in Cairo is..."
```

Tool responses are injected as `role: 'user'` parts containing `functionResponse` objects — this is the Gemini ADK convention.

---

## Adding a tool

Every tool is an `AgentTool` object. The interface is in `src/types/tool.ts`:

```typescript
interface AgentTool {
  name: string;                // unique, snake_case — this is what the LLM calls
  description: string;         // THE MOST IMPORTANT FIELD — how the LLM knows when to use it
  permission: 'allow' | 'ask' | 'deny';
  parameters: JsonSchema;      // JSON Schema for the tool's args
  fallbackToolName?: string;   // if this tool fails, HealingEngine tries this one instead
  execute(args, ctx): Promise<ToolResult>;
}
```

### Step-by-step

**1. Create `src/tools/my-tool.ts`:**

```typescript
import type { AgentTool } from '../types/index.js';

export function makeMyTool(): AgentTool {
  return {
    name: 'my_tool',
    description:
      'One sentence: what it does, when to use it, what it returns. ' +
      'The model picks tools by reading this — be specific.',
    permission: 'allow',   // or 'ask' for destructive operations
    parameters: {
      type: 'object',
      description: 'My tool params',
      properties: {
        input: { type: 'string', description: 'The input text' },
      },
      required: ['input'],
    },
    async execute(args, ctx) {
      const input = String(args.input ?? '');
      if (!input) return { error: 'input is required' };

      // ctx.workspacePath — the workspace directory
      // ctx.session       — current session (key, channel, senderId, ...)
      // ctx.config        — full Config object

      return { success: true, result: `Processed: ${input}` };
    },
  };
}
```

**2. Write a test `src/tools/my-tool.test.ts`** (TDD first):

```typescript
import { describe, it, expect } from 'vitest';
import { makeMyTool } from './my-tool.js';

const ctx = () => ({ session: { key: 's', ... }, workspacePath: '/tmp', config: {} as never });

describe('my_tool', () => {
  it('returns processed result', async () => {
    const tool = makeMyTool();
    const r = await tool.execute({ input: 'hello' }, ctx());
    expect(r.success).toBe(true);
    expect(String(r.result)).toContain('hello');
  });

  it('errors when input is missing', async () => {
    const tool = makeMyTool();
    const r = await tool.execute({}, ctx());
    expect(r.error).toBeDefined();
  });
});
```

**3. Register in `src/index.ts`:**

```typescript
import { makeMyTool } from './tools/my-tool.js';
// ...
registry.register(makeMyTool());
```

**4. Update `src/tools/AGENTS.md`** with a row in the tool inventory table.

### Tool description rules

The description is the model's only signal for choosing this tool. Write it like documentation for a smart reader who has never seen the codebase:

| Bad | Good |
|-----|------|
| `"Reads files"` | `"Read a file from the workspace. Returns the full contents. Use when the user asks to view or inspect a file."` |
| `"Creates PDFs"` | `"Generate a PDF document from a title + sections. Saves to workspace/output/. Use for reports, briefs, and summaries."` |

### Permission levels

| Permission | Behavior |
|-----------|---------|
| `allow` | Executes automatically |
| `ask` | Runner calls `ApprovalGate` callback before executing; in current impl, all `ask` tools execute but are logged for audit |
| `deny` | Tool is registered but never exposed to the model |

### Fallback chains

If a tool can fail and there's a less-capable alternative, set `fallbackToolName`:

```typescript
{
  name: 'browser_fetch',
  fallbackToolName: 'web_fetch',  // HealingEngine uses this on failure
  ...
}
```

---

## Adding a sub-agent profile

Profiles live in `src/multi-agent/profiles/index.ts`. A profile constrains the sub-agent to a specific role: only certain tools, a specific model, and a custom bootstrap prompt.

```typescript
export const MySpecialistAgent: AgentProfile = {
  id: 'my-specialist',
  role: 'One sentence describing what this agent does',
  reportsTo: 'main agent',
  bootstrap: [
    'You are a specialist agent. Your job is X.',
    'Process: step 1 → step 2 → step 3.',
    'Return a structured result with Y.',
    'Do not ask clarifying questions — make assumptions and proceed.',
  ].join('\n'),
  defaultModel: 'flash',   // 'flash' for fast/cheap, 'pro' for deep reasoning
  toolAllowlist: ['web_search', 'web_fetch'],  // only these tools are visible
  maxToolRounds: 6,
};

// Add to the registry
export const PROFILES: Record<string, AgentProfile> = {
  // existing...
  'my-specialist': MySpecialistAgent,
};
```

Then export a typed spawn tool:

```typescript
// src/tools/spawn.ts
export function makeSpawnMySpecialistTool(o: MultiAgentOrchestrator): AgentTool {
  return makeProfileSpawnTool(o, 'my-specialist', 'spawn_my_specialist');
}
```

Register in `src/index.ts`:

```typescript
registry.register(makeSpawnMySpecialistTool(orchestrator));
```

**Critical invariant:** sub-agents never see parent conversation history. They receive only:
- Their profile's bootstrap prompt
- The `goalChain` ancestry (e.g. `["Summarize the Flutter changelog", "Find all changelog entries"]`)
- The agent's identity + memory snippets from the workspace

---

## Teaching the agent a new skill

Skills are markdown files in `workspace/skills/`. No code changes needed — the agent reads them at bootstrap.

**File structure:**

```markdown
---
name: research-topic
description: Use when the user asks for research on a topic. Searches multiple sources, extracts key facts, returns structured summary.
when_to_invoke: User says "research X", "look into Y", "find me sources on Z"
---

## Steps
1. Use memory_recall to check if you already know the answer
2. web_search the topic — at least 3 queries from different angles
3. web_fetch the top 2-3 results for full content
4. Cross-reference, deduplicate
5. Save new facts to memory bank via memory_save
6. Return structured summary with source URLs
```

The `description` is what the model reads when choosing a skill. Make it specific and trigger-phrased.

The `ContextEngine` loads skill files on every bootstrap:
1. Lists `workspace/skills/*.md`
2. Reads each file's frontmatter (`name`, `description`)
3. Injects a skill index into the system prompt: `## Available Skills\n- research-topic: Use when...`
4. The model calls `load_skill('research-topic')` to read the full body when it decides to use it

The agent can also draft new skills based on its own sessions. If you notice the agent doing something repetitive, prompt it: "Create a skill file for this so you remember how to do it next time."

---

## Memory system

The memory system has three tiers:

### Tier 1 — In-context history
Messages in the current session, held in `messages` table. Visible to the model via the agent loop's `contents` array. Limited by the model's context window.

**Compaction** fires when the estimated token count hits 80% of the model window:
1. Finds the last compaction checkpoint (or start of history)
2. Takes the oldest 60% of remaining messages
3. Sends to Gemini: "Summarize this conversation preserving all IDs, URLs, file paths, task status, decisions"
4. Stores the summary as a `compaction_checkpoints` row
5. Original messages are **never deleted** — they stay for the audit trail

### Tier 2 — Daily notes
`workspace/memory/YYYY-MM-DD.md` — append-only log of events, decisions, and observations during a session. Written via `daily_append` tool. Read by `ContextEngine` (today's file is always in the system prompt).

The Consolidator (`src/memory/consolidator.ts`) can promote daily note entries into the memory bank:
```typescript
await consolidator.consolidate(); // reads today's note, extracts structured facts
```

### Tier 3 — Memory bank
`workspace/bank/{facts,decisions,projects,people}/` — durable structured storage. Each file is a named markdown document with YAML frontmatter.

```typescript
// Saving a fact
await memoryBank.save({
  category: 'facts',
  name: 'flutter-version',
  content: 'As of 2026-05, Flutter stable is 3.32...',
  tags: ['flutter', 'versions'],
});

// Recall (grep-based in v1)
const results = await memoryBank.recall('flutter version');
// → returns matched files sorted by relevance
```

`workspace/MEMORY.md` is the curated long-term summary — a human-readable index of what the agent remembers. Keep it under ~20K tokens. Route raw events to daily notes; promote only durable facts to `MEMORY.md`.

---

## Self-healing engine

`HealingEngine` (`src/healing/engine.ts`) wraps operations that can fail transiently.

### Error classification

`classifyError(err)` → `ClassifiedError` with `kind`:

| Kind | Examples | Strategy |
|------|---------|---------|
| `auth` | HTTP 401, invalid API key | Escalate immediately — retry won't fix auth |
| `permission` | HTTP 403 | Escalate immediately |
| `notFound` | HTTP 404 | Escalate — resource doesn't exist |
| `rateLimit` | HTTP 429, "retry-after: 30s" | Retry after `retryAfterMs` |
| `serverError` | HTTP 5xx | Retry → fallback model |
| `timeout` | AbortError, ETIMEDOUT | Retry with longer delay |
| `network` | ENOTFOUND, ECONNRESET | Retry |
| `unknown` | anything else | Retry once |

### HealingEngine API

```typescript
// Retry a flaky operation
const result = await healing.withRetry(
  () => callGemini(model, contents),
  { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000, context: 'generateContent' }
);

// Try primary, fall back to alternative on failure
const { result, usedFallback } = await healing.withFallback(
  () => callGemini('gemini-2.5-pro', contents),
  () => callGemini('gemini-2.5-flash', contents),
  { context: 'model-fallback' }
);

// Both: retry + fallback (what AgentRunner uses)
const { result } = await healing.protect(primary, fallback, opts);
```

### Adding a new recovery path

1. Add a new `ErrorKind` in `src/healing/types.ts`
2. Add a detection case in `classifier.ts`
3. Handle the new kind in `engine.ts`'s `withRetry` switch

---

## Configuration reference

`.env` file (created by `npm run setup`). All values are optional except the starred ones.

| Variable | Default | Notes |
|----------|---------|-------|
| `GEMINI_API_KEY` * | — | From https://aistudio.google.com/apikey |
| `TELEGRAM_BOT_TOKEN` * | — | From @BotFather |
| `ALLOWED_SENDERS` * | — | Comma-separated Telegram user IDs. **Empty = reject all** |
| `DEFAULT_MODEL` | `gemini-2.5-pro` | Primary model |
| `FALLBACK_MODEL` | `gemini-2.5-flash` | Used by HealingEngine on server errors |
| `MAX_TOOL_ROUNDS` | `15` | Caps the agent loop per turn |
| `COMPACTION_THRESHOLD` | `0.8` | Fire compaction at 80% context |
| `HEARTBEAT_INTERVAL_MS` | `1800000` | 30 min; `0` = disabled |
| `DAILY_TOKEN_BUDGET` | `0` | Per-sender tokens/day; `0` = unlimited |
| `TIMEZONE` | `UTC` | Cron quiet-hours timezone |
| `PORT` | `3000` | Express listen port |
| `HOST` | `127.0.0.1` | Express listen host |
| `DATABASE_PATH` | `./data/adkclaw.db` | SQLite file |
| `WORKSPACE_PATH` | `./workspace` | Agent's memory directory |

`agent.yaml` (in workspace root) holds non-secret runtime config:
```yaml
name: "Aria"
tone: "concise and direct"
traits: ["curious", "methodical"]
```

---

## Testing guide

Test runner: **Vitest** with Node environment. Tests live alongside source files as `*.test.ts`.

### Running tests

```bash
npm test                                     # all 144 tests
npm test -- src/agent/runner.test.ts         # single file
npm test -- -t "budget exceeded"             # single test by name pattern
npm test -- --reporter=verbose               # verbose output
npm test -- --watch                          # watch mode
```

### Test patterns in use

**Unit tests with temp directories:**
```typescript
let workspace: string;
beforeEach(() => { workspace = mkdtempSync(join(tmpdir(), 'adkclaw-')); });
afterEach(() => { rmSync(workspace, { recursive: true, force: true }); });
```

**Fake ToolContext:**
```typescript
function ctx(): ToolContext {
  return {
    session: { key: 's', kind: 'main', parentKey: null, channel: null,
               target: null, senderId: null, createdAt: 0, updatedAt: 0,
               lastMessageAt: null, model: '', totalTokens: 0, isArchived: false },
    workspacePath: workspace,
    config: {} as never,
  };
}
```

**Mocking Google GenAI (from `src/agent/runner.test.ts`):**
```typescript
const mockClient = {
  models: {
    generateContent: vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
      usageMetadata: { totalTokenCount: 50 },
    }),
  },
};
```

**Mocking Playwright (from `src/tools/browser.test.ts`):**
```typescript
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(), content: vi.fn().mockResolvedValue('<html>...</html>'),
        screenshot: vi.fn(), pdf: vi.fn(), close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));
```

### What NOT to test

- Tool descriptions (they're strings, not behavior)
- The exact format of log output
- Internal implementation details of `better-sqlite3`
- Network calls in unit tests — always mock the HTTP client

---

## Debugging

### Common startup errors

| Error | Fix |
|-------|-----|
| `GEMINI_API_KEY is required` | Run `npm run setup` or set key in `.env` |
| `TELEGRAM_BOT_TOKEN is required` | Run `npm run setup` or leave unset to skip Telegram |
| `ALLOWED_SENDERS is required` | Add your Telegram user ID (get it from @userinfobot) |
| `Cannot find module './dist/...'` | Run `npm run build` first |

### Inspecting sessions

```bash
# All active sessions
curl http://localhost:3000/api/sessions | jq

# Full conversation + tool calls
curl http://localhost:3000/api/sessions/cli:local | jq

# Immutable audit dump (includes compaction checkpoints)
curl http://localhost:3000/api/audit/cli:local | jq

# Agent status: uptime, token usage
curl http://localhost:3000/api/status | jq
```

### Reading the daemon logs

The runner logs every turn in this format:
```
[telegram:5025183377] ▸ What is the weather in Cairo?
  → tool web_search({"query":"weather Cairo today"})
  ← tool web_search ✓ The weather in Cairo is 32°C...
[telegram:5025183377] ◂ The current temperature in Cairo is 32°C... (completed, 1 tools, 845 tokens, 1200ms)
```

Format: `[session-key] ▸ <user-message>` / `[session-key] ◂ <reply> (<reason>, <tools> tools, <tokens> tokens, <ms>ms)`

### SQLite inspection

```bash
sqlite3 data/adkclaw.db
.tables
SELECT key, channel, total_tokens FROM sessions;
SELECT role, substr(content,1,80) FROM messages WHERE session_key='cli:local' ORDER BY created_at;
SELECT * FROM cron_jobs;
```

---

## Architecture decisions

### Why Google ADK + Gemini only

Teaching one stack deeply is better than supporting N providers. Gemini 2.5 Pro has a 1M-token context window which simplifies context management, and Search Grounding is first-class (not a plugin).

### Why SQLite over Postgres

`better-sqlite3` is synchronous, zero-config, and survives a `git clone`. Upgrading to Postgres/pgvector is one file change. The session/message schema is identical.

### Why workspace files for memory

Files are auditable, diffable, and directly editable. The agent doesn't need to query a vector DB to know its own name — it reads `workspace/IDENTITY.md`. This also makes the memory system transparent for teaching: students can read exactly what the agent knows.

### Why not LangGraph / LlamaIndex

AdkClaw teaches ADK. LangGraph is the peer alternative (state machines vs. function calling); we acknowledge it in the docs without adopting it. The goal is one coherent stack students understand end-to-end.

### Why compaction over truncation

Truncating old messages loses context. Compaction preserves the structure of past work (decisions, IDs, file paths) at the cost of one Gemini call. At 80% threshold there's enough headroom to generate the summary.

### Why `MAX_TOOL_ROUNDS = 15`

Enough for complex multi-step tasks (research → write → save). Low enough that a runaway tool loop fails fast and is diagnosable. Configurable via env for advanced users.

### The "never crashes" design

Three layers:
1. `HealingEngine` catches transient errors inside a turn (retry + model fallback)
2. `finishReason: 'error'` means the turn failed cleanly — the session is intact, no state is lost
3. Process supervisor (pm2 / systemd) restarts on hard crashes — SQLite + workspace files mean nothing is lost
