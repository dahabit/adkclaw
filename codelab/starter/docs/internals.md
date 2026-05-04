# AdkClaw Internals

Deep dives into how the core modules work. Read this when debugging unexpected behavior or implementing new core capabilities.

## Context bootstrap

`ContextEngine.bootstrap()` assembles the system prompt. Called on every turn — but cached.

**Cache key:** aggregate `mtime` fingerprint of all workspace files. If no file has changed since the last call, returns the cached prompt. Call `contextEngine.invalidate()` to force a rebuild.

**Read order (strict):**
```
IDENTITY.md   → who the agent is (name, role)
USER.md       → user profile
SOUL.md       → personality, tone, quirks
AGENTS.md     → behavioral rules
MEMORY.md     → curated long-term memory
memory/<today>.md → today's events (if exists)
HEARTBEAT.md  → task list
```

After the core files, `ContextEngine` appends:
1. **Bank index** — one line per `bank/*/*.md` file: `- facts/flutter-version.md: Flutter stable is 3.32...`
2. **Skills index** — one line per `skills/*.md` file: `- research-topic: Use when the user asks for research...`

The system prompt is the concatenation of all these sections. The model receives it on every call via `config.systemInstruction`.

**What happens when a file is missing:** the file is silently skipped. The agent still boots. Missing `IDENTITY.md` means the agent has no stated identity — it will self-describe generically.

---

## SQLite schema

Five tables, all in `data/adkclaw.db` (WAL mode, foreign keys ON):

```sql
sessions (
  key TEXT PRIMARY KEY,         -- "telegram:5025183377", "cli:local"
  kind TEXT,                     -- "main" | "isolated" (sub-agents)
  parent_key TEXT,               -- set for sub-agent sessions
  channel TEXT,                  -- "telegram" | "http" | null
  target TEXT,                   -- where to deliver responses
  sender_id TEXT,                -- for budget guard / allowlist
  created_at INTEGER,
  updated_at INTEGER,
  last_message_at INTEGER,
  model TEXT,
  total_tokens INTEGER,
  is_archived INTEGER
)

messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT REFERENCES sessions(key),
  role TEXT,                     -- "user" | "assistant" | "tool" | "system"
  content TEXT,                  -- text for user/assistant messages
  tool_name TEXT,                -- set for role="tool"
  tool_args TEXT,                -- JSON
  tool_result TEXT,              -- JSON
  tokens INTEGER,
  metadata TEXT,                 -- JSON, arbitrary per-message data
  created_at INTEGER
)

compaction_checkpoints (
  id, session_key, summary TEXT, original_message_count,
  summarized_message_ids TEXT,   -- JSON array of message IDs included
  tokens_before, tokens_after, created_at
)

cron_jobs (
  id TEXT PRIMARY KEY,           -- UUID
  name, schedule_kind, schedule TEXT,
  task TEXT,                     -- the prompt sent to the agent
  session_key, channel, target,
  enabled INTEGER,
  idempotency_key TEXT,
  created_at, updated_at, last_run_at, next_run_at
)

cron_runs (
  id, job_id, fired_at, completed_at,
  status TEXT,                   -- "ok" | "error" | "skipped"
  result TEXT, error TEXT,
  idempotency_key TEXT UNIQUE    -- minute-bucket key: "<jobId>:<floor(ms/60000)>"
)
```

**Append-only contract:** `messages` rows are never deleted. Compaction creates a new `compaction_checkpoints` row; original messages stay. This ensures the audit endpoint (`GET /api/audit/:key`) returns the full unmodified history.

---

## Tool registry internals

`ToolRegistry` (in `src/tools/registry.ts`) does three things:

**1. Registration**
```typescript
registry.register(myTool);  // stored in a Map<name, AgentTool>
```

**2. Convert to SDK declarations**
```typescript
registry.toFunctionDeclarations()
// → [{ name: 'my_tool', description: '...', parameters: { ... } }]
// These are passed directly to the Gemini API as tool declarations
```

**3. Execute by name**
```typescript
const result = await registry.execute('my_tool', args, ctx);
// Looks up the tool, calls tool.execute(args, ctx)
// Returns { error: 'tool not found' } if name doesn't exist
```

The registry has no permission enforcement at execution time in v1 (all `ask` tools execute). The `permission` field is used for audit logging and documentation. A future version can gate `ask` tools behind an `ApprovalGate` callback.

---

## Healing engine state machine

```
                    ┌──────────────────────────────────────┐
  call()            │                                      │
  ─────►  classify  │  auth / permission / notFound        │  escalate (throw)
                    │  ─────────────────────────────────►  │
                    │                                      │
                    │  rateLimit (with retry-after)        │
                    │  ─────────────────────────────────►  │  sleep(retryAfterMs) → retry
                    │                                      │
                    │  serverError / timeout / network     │
                    │  ─────────────────────────────────►  │  exp backoff → retry
                    │                                      │  (1s, 2s, 4s, max 8s)
                    │  unknown                             │
                    │  ─────────────────────────────────►  │  retry once
                    │                                      │
                    │  all retries exhausted               │
                    │  ─────────────────────────────────►  │  withFallback → try fallback
                    │                                      │  if fallback fails → throw
                    └──────────────────────────────────────┘
```

`protect(primary, fallback, opts)` = `withRetry` wrapping `withFallback`:
- Primary is called first. On retryable failure, it's retried up to `maxAttempts`.
- If all retries fail, the fallback is called once.
- If the fallback also fails, the error is thrown to the caller.

The runner catches that throw and returns `finishReason: 'error'`.

---

## Sub-agent isolation model

When the orchestrator spawns a sub-agent:

```typescript
orchestrator.spawn({ task, parentSessionKey, profileId, goalChain })
```

1. Creates a new session `kind='isolated'`, `parentKey=<caller's key>`
2. Builds `extraSystemPrompt` = profile bootstrap + goalChain framing:
   ```
   [You are a sub-agent spawned for ONE specific task.]
   [Goal ancestry: outer goal → this task]
   [Your job: <task description>]
   [Profile bootstrap: ...]
   ```
3. Calls `runner.run()` with `allowedToolNames` restricted to `profile.toolAllowlist`
4. **Always archives the child session** in a `finally` block — no orphaned sessions

The child session gets the same `ContextEngine` bootstrap (same workspace files) but a different message history (starts fresh). It cannot access parent conversation history. It can access the memory bank (shared workspace).

**Timeout:** the orchestrator wraps the runner call in `Promise.race` with `profile.timeoutMs ?? 120_000`. On timeout, the session is archived and an error is returned.

---

## Cron idempotency

The `CronEngine` uses node-cron to fire scheduled jobs. Each fire:

1. Computes `bucketKey = '<jobId>:<Math.floor(firedAt / 60000)>'`
2. Attempts to insert into `cron_runs(idempotency_key)` which has a `UNIQUE` index
3. If the insert fails (duplicate key), the job is skipped — idempotent
4. If the insert succeeds, the job runs

This means: if the daemon restarts mid-minute, the job that already fired won't fire again when the cron ticks at the next minute. Jobs missed during a long downtime do NOT catch up — only the next scheduled tick fires.

**Why minute-buckets not exact timestamps:** node-cron fires within a second of the scheduled time but not at the exact millisecond. A millisecond-based key would cause double-fires after restarts.

---

## Token counting and compaction threshold

`src/context/token-counter.ts` uses the cl100k_base tiktoken encoding (same as GPT-4). This is an approximation for Gemini models, but conservative enough to be safe.

The compaction threshold check in `ContextEngine`:

```typescript
const estimatedTokens = countTokens(systemPrompt + allMessages);
const windowSize = MODEL_WINDOW_TOKENS[model] ?? 200_000;
if (estimatedTokens / windowSize >= config.compactionThreshold) {
  await compaction.compact(sessionKey);
}
```

After compaction, the session's effective message count drops because old messages are replaced by a summary in the system prompt (via the checkpoint). The original messages remain in the DB for audit purposes.

---

## Telegram adapter internals

`TelegramAdapter` (in `src/channels/telegram.ts`):

**Incoming messages:**
1. Telegraf receives `bot.on('text', ...)` event
2. Checks sender ID against `config.telegram.allowedSenders` — rejects if not in list
3. Normalizes to `AgentRequest` with `sessionKey = 'telegram:<senderId>'`
4. Calls `runner.run(req)`
5. Sends the response text back, chunked to Telegram's 4000-char limit

**Outbound delivery:**
```typescript
await adapter.deliver(chatId, text);
```
Used by cron jobs and heartbeat to send proactive messages. Chunks automatically.

**Allowlist enforcement:** if `ALLOWED_SENDERS` is empty, all messages are rejected. This is intentional — the default is "reject everyone" until you explicitly opt in users.

---

## Heartbeat internals

`Heartbeat` fires on `heartbeatIntervalMs` (default: 30 min).

1. Reads `workspace/HEARTBEAT.md`
2. Skips if the file is empty or contains only the placeholder (`# Tasks`)
3. Calls `runner.run()` with the task list as the message
4. If the response text matches `HEARTBEAT_OK` (the agent returns this string when there's nothing to do), the delivery is suppressed
5. If the response has actual content, calls `delivery(channel, target, text)`
6. Respects quiet hours: `start=22, end=7` — no delivery between 22:00 and 07:00

The agent is taught (via `workspace/AGENTS.md`) to return `HEARTBEAT_OK` when the heartbeat check finds nothing actionable, so the user isn't spammed every 30 minutes.
