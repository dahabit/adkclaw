# Teaching Guide — How AdkClaw Was Built (and Why)

This is the **study companion** for AdkClaw. It explains every architectural decision, every folder's purpose, and the line between **the SDK we depend on** and **the code we wrote**. Read it cover-to-cover before teaching the workshops — your students will ask "why?" about every choice, and the answers all live here.

---

## 1. The thesis: what is an autonomous agent?

A chatbot answers questions. An autonomous agent **acts on the world**, **remembers**, **recovers from failure**, and **collaborates with other agents** — all without a human in the loop for every step.

We define an autonomous agent by **six pillars**. AdkClaw teaches each one by building it:

| Pillar | What it means | Where it lives in our code |
|--------|---------------|---------------------------|
| **Brain** | The LLM that thinks | `src/agent/runner.ts` (calls Gemini) |
| **Tools** | Hands to act on the world | `src/tools/` (21 tools) |
| **Memory** | Remembers across turns + sessions | `src/context/`, `src/memory/`, `workspace/` |
| **Personality** | Identity + tone, not just text | `workspace/IDENTITY.md`, `SOUL.md` |
| **Self-healing** | Never crashes | `src/healing/` |
| **Sub-agents** | Specialists collaborating | `src/multi-agent/` |

A **chatbot** has only #1. A **RAG system** has #1+#3. A **tool-using agent** has #1+#2+#3. **Autonomy** means all six.

---

## 2. Why these technology choices?

### Why TypeScript + Node.js?

| Choice | Reason |
|--------|--------|
| **TypeScript** | Tool schemas are typed contracts between the LLM and our code. JS without types makes "what does this tool return?" guesswork. TS makes it a compile error when wrong. |
| **Node.js 22+** | Agents are **I/O-bound**, not CPU-bound — they wait on LLM responses, file reads, HTTP calls. Node's async event loop is exactly the right runtime. |
| **Single language** | The agent's brain talks to its tools, channels, storage, and HTTP API in one language. No FFI, no marshalling. |
| **`tsx`** | Runs `.ts` files directly without a build step in dev. Compiles once for prod (`tsc`). |
| **ES Modules (`type: "module"`)** | The modern JS module system. Required by `@google/genai`. Forces `.js` extensions in imports — that's intentional, not a bug. |

### Why Google ADK + Gemini?

| Choice | Reason |
|--------|--------|
| **Gemini 3.1 Pro / 3 Flash** | 1M-token context (massive headroom for our memory experiments), native tool calling, strong reasoning at low cost. Flash is ~10× cheaper than Pro — perfect for sub-agents. |
| **Google ADK** (`@google/genai`) | First-party SDK. Function calling is a native concept, not bolted on. Grounding (web search) is built-in. |
| **No LangChain / LangGraph / CrewAI** | These are **abstractions over abstractions**. Students who learn AdkClaw understand what's *under* those frameworks. We use the raw SDK so every layer is teachable. |
| **No MCP** | Model Context Protocol is a tool-discovery standard. Out of scope for v1 — we register tools explicitly so students see the wiring. Documented as future work. |

### Why Telegram + CLI (no web chat)?

| Choice | Reason |
|--------|--------|
| **Telegram** | Free bot API, push notifications, mobile-friendly, no auth UI to build. The student's phone *is* the agent's interface. |
| **Terminal CLI** | Fast iteration. Same `/api/chat` endpoint Telegram uses. |
| **No web chat UI** | Saves ~500 LOC, two files, one dep. Adds zero pedagogical value over CLI + Telegram. |
| **HTTP API (`/api/chat`)** | Both Telegram and CLI POST to it. One agent runtime, two interfaces. Anyone can write a third client. |

### Why SQLite, not Postgres / Redis / Vector DB?

| Choice | Reason |
|--------|--------|
| **`better-sqlite3`** | Synchronous, embedded, **zero-config**. `npm install` and you have a database. Production-grade for single-host agents. |
| **Filesystem for memory bank** | Agents that "live in `~/.config/myagent/`" are self-contained. `git diff` shows what the agent learned. The user can `cat` their agent's memories. |
| **No vector DB in v1** | Vector search is taught in **WS3** with Vertex AI. Plain text + `grep` is enough for the first 80% of memory recall and is far easier to debug. |

---

## 3. Native SDK vs. custom code — drawing the line

This is the question students will ask first. Be precise.

### The native SDK lives in `node_modules/@google/genai/`

It provides:
- `GoogleGenAI` — the client class
- `client.models.generateContent({...})` — sends prompts to Gemini, returns responses
- `Content`, `Part`, `FunctionCall`, `Tool`, `FunctionDeclaration` — the type system for messages and tool calls
- Streaming support (`generateContentStream`)
- Token counting helper (`countTokens`)

That's it. **The SDK does not give you an agent.** It gives you a way to call an LLM with tools.

### What we built on top — 5,300 lines of TypeScript

Everything in `src/` is custom code. Specifically:

| Component | What it does | Why we wrote it |
|-----------|-------------|-----------------|
| `src/agent/runner.ts` | The **agent loop** | The SDK returns one response. To get an agent, you wrap it in `while (toolCalls) execute → append → call again`. |
| `src/tools/registry.ts` | Tool registry + permission model | The SDK takes raw `FunctionDeclaration[]`. Our registry adds `permission`, `fallbackToolName`, validation, and a unified `execute()` interface. |
| `src/context/manager.ts` | System prompt assembly | The SDK accepts a `systemInstruction` string. We compose ours from 7 workspace files in a fixed order, with caching keyed on file mtime. |
| `src/context/compaction.ts` | Conversation summarization | The SDK has a 1M-token limit. When you hit 80%, you must summarize older turns yourself — the SDK won't do it. |
| `src/healing/engine.ts` | Error recovery | The SDK throws on rate limits and 5xx. Our engine catches, classifies, retries with backoff, falls back to a cheaper model. The promise: **the agent never crashes.** |
| `src/memory/bank.ts` | Structured memory taxonomy | The SDK has no memory. We invented a 4-folder taxonomy (facts/decisions/projects/people) and consolidator that demotes daily notes into permanent records. |
| `src/multi-agent/orchestrator.ts` | Sub-agent spawning | We let an agent spawn another agent in an isolated session. The SDK has no concept of a sub-agent — that's our pattern. |
| `src/sessions/store.ts` | Conversation persistence | The SDK is stateless. Every call is independent. We hold a SQLite-backed session store keyed by `<channel>:<senderId>`. |
| `src/cron/engine.ts` | Scheduled jobs | Agents that only react aren't autonomous. Cron + heartbeat let the agent *initiate* — wake up at 9 a.m. and check for news. |
| `src/skills/loader.ts` | Markdown skills | A practical teaching pattern: drop a `.md` file in `workspace/skills/`, agent learns it. No code, no redeploy. |
| `src/channels/telegram.ts` | Telegram adapter | Pure plumbing: receive update → normalize → call agent → reply. ~150 lines. |
| `src/server/http.ts` | Express server | `/api/chat`, `/api/status`, audit endpoints, admin dashboard. |
| `src/cli/` | CLI entry points | `setup` (wizard), `start` (daemon), `chat` (REPL), `check` (diagnostics). |

**Mental model**: think of `@google/genai` as the **engine**. AdkClaw is the **car** — chassis, steering, dashboard, gas tank, repair kit. Same engine could power any agent; we built the surrounding vehicle.

---

## 4. Folder-by-folder walkthrough

```
adkclaw/
├── src/                ← reference implementation (finished agent — post-L4)
├── level_0/ … level_4/ ← per-level workshop structure
│   ├── level_N/
│   │   ├── starter/    ← self-contained Level N starter
│   │   │   ├── package.json, tsconfig.json, src/, workspace.example/
│   │   │   └── scripts/verify.ts (offline checkpoint)
│   │   ├── codelab.md  ← anchored to level_N/starter/ markers
│   │   └── README.md
│
├── solutions/
│   ├── level_1/ … level_4/  ← complete answer keys (one per level)
│   │   ├── package.json, tsconfig.json, src/, workspace/
│   │   └── README.md
│
├── docs/               ← repo-root documentation (teaching-guide.md, tech-stack.md)
├── systemd/            ← Linux service unit
├── workshop.config.json ← shared metadata (model IDs, level durations)
├── RUNBOOK.md          ← operating your deployed agent (L4 graduates)
└── README.md           ← user-facing intro
```

> Legacy `codelab/starter/` and `level_5/` directories will be removed in Stage 3 of the restructure. L5 content (security hardening) is folded into L3 startup gates and L4 deployment-time gates; see `level_3/codelab.md §1.5` and `level_4/codelab.md §6.5`.

### `src/` — the reference implementation

**The finished agent** — post-Level 4 with all 21 tools, multi-agent orchestration, healing, cron, Firestore adapter. Study this as the answer key; don't clone it as your starting point.

| Folder | Contains | Pillar it serves |
|--------|----------|------------------|
| `agent/` | `runner.ts` (loop), `budget.ts` (token cap) | Brain |
| `context/` | `manager.ts` (bootstrap), `compaction.ts`, `token-counter.ts` | Memory |
| `tools/` | One file per tool category (filesystem, web, content, …) | Tools |
| `memory/` | `bank.ts`, `daily-notes.ts`, `consolidator.ts` | Memory |
| `healing/` | `engine.ts`, `classifier.ts` | Self-healing |
| `multi-agent/` | `orchestrator.ts`, `profiles/` (4 specialists) | Sub-agents |
| `skills/` | `loader.ts` (reads `workspace/skills/`) | Memory + extensibility |
| `cron/` | `engine.ts`, `heartbeat.ts` | Autonomy |
| `sessions/` | `store.ts` (SQLite), `migrations.ts` | Persistence |
| `channels/` | `telegram.ts` (telegraf adapter) | Interface |
| `server/` | `http.ts` (Express, dashboard) | Interface |
| `cli/` | `setup.ts`, `repl.ts`, `index.ts` | Developer experience |
| `config/` | `index.ts` (env + agent.yaml loader, validator) | Config |
| `types/` | shared TypeScript interfaces | Glue |

**Why this layout?** Each folder maps to a **single concept** a student can learn in one sitting. We resisted naming things "core/" or "lib/" — every folder name describes a real-world responsibility.

### `workspace/` — the agent's brain on disk

This is **not source code**. It's data the agent reads on every turn:

| File | Purpose | Who writes it |
|------|---------|---------------|
| `IDENTITY.md` | "Who am I? What's my role?" | `npm run setup` (or builder edits) |
| `USER.md` | "Who is talking to me? Their preferences?" | Setup wizard, agent updates over time |
| `SOUL.md` | "How do I speak? What's my tone, my quirks?" | Setup wizard |
| `AGENTS.md` | Behavioral rules (e.g., "always cite sources") | Builder writes these |
| `MEMORY.md` | Curated long-term memory (capped ~20K tokens) | Consolidator promotes from daily notes |
| `memory/YYYY-MM-DD.md` | Raw daily notes — every fact the agent learns | Agent writes via `daily_append` tool |
| `bank/facts/*.md`, `decisions/`, `projects/`, `people/` | Structured taxonomy — searchable | `memory_save` tool |
| `skills/*.md` | Markdown skills with frontmatter | Builder or agent |
| `HEARTBEAT.md` | Task list checked by cron heartbeat | Builder or agent |
| `output/` | Where the agent writes PDFs, presentations, reports | Content tools |

**Key teaching point**: students will ask "why files instead of a database?" Three reasons:
1. **Auditable**: `cat MEMORY.md` shows you everything the agent thinks.
2. **Versionable**: `git diff` shows what the agent learned this week.
3. **Portable**: copy the folder, copy the agent's mind.

A vector database is *not* better here for the first 100K facts. It's faster to search, slower to debug.

### `data/` — runtime artifacts

- `adkclaw.db` — SQLite DB (sessions, messages, cron jobs, compaction checkpoints, audit log)
- Gitignored. Everything in here is rebuildable from `workspace/` + the LLM.

### The per-level structure

Each level has its own **self-contained starter**:

```
level_N/
├── starter/          ← self-contained starter (own package.json, src/, workspace.example/)
│   ├── package.json  ← students run "npm install" here
│   ├── tsconfig.json
│   ├── src/          ← source with //REPLACE-* markers and throwing stubs
│   └── scripts/verify.ts ← offline checkpoint (tsc + vitest)
├── codelab.md        ← anchored to starter/ with marker locations
└── README.md         ← build flow guide
```

Students work in `level_N/starter/`, fill `//REPLACE-*` markers as the codelab instructs, and run `npm run verify` to type-check and test offline (no Gemini key needed for the checkpoint). The answer key lives at `solutions/level_N/`.

**Marker placement rule (test-conflict invariant):** a file with tests under `src/` cannot carry a REPLACE marker — the stub would break the test on first `verify`. So files like `src/healing/engine.ts` (which ships with 8 retry/fallback tests) stay pre-provided in the starter; the codelab teaches them as "study this", not "fill this". Markers concentrate on one or two central patterns per level, where the lesson is the *implementation* itself.

---

## 4.5 Teaching with the per-level starters

**This section is for instructors.** All four levels (L1–L4) ship in the per-level-starter format. Here's how the model works in the classroom.

### Student workflow

Each level is a **standalone project**:

```bash
cd ~/adkclaw/level_N/starter
npm install
npm run verify              # offline checkpoint: tsc --noEmit + vitest run
```

The starter has **pre-scaffolded code** with `// REPLACE-*` marker comments and throwing compilation stubs:

```typescript
// src/agent/runner.ts
async callGemini(/*...*/): Promise<ContentResponse> {
  // REPLACE: Implement the single call to client.models.generateContent({...})
  throw new Error('Not implemented');
}
```

Students open the file, find the marker, replace the stub with the actual code. The starter **type-checks before any marker is filled** — `npm run verify` forces type safety on the scaffold itself.

### Marker convention

Markers appear in two forms:

1. **Exact markers** — the codelab shows the exact code to write:
   ```markdown
   Find `// REPLACE: callGemini` in `src/agent/runner.ts` line 42.
   Replace it with:
   ```typescript
   const response = await client.models.generateContent({...});
   return response;
   ```

2. **Personality/domain markers** — optional AI Studio path with a hand-write fallback:
   ```typescript
   // REPLACE-AGENT-PERSONALITY: Define your agent's tone
   // (Hand: Write 2–3 sentences. AI Studio: Use Gemini to draft one.)
   const personality = "...";
   ```
   Markers like `AGENT-PERSONALITY`, `SYSTEM-RULES`, `DOMAIN-KNOWLEDGE` offer an optional AI-assisted path. Students can use the AI Studio link in the codelab or hand-write it; both paths are valid.

### The offline checkpoint (`npm run verify`)

`scripts/verify.ts` is a Hybrid rule: it runs **deterministically, no Gemini key required, no network calls**.

```bash
npm run verify
# runs: tsc --noEmit (typecheck) + vitest run (unit tests)
# output: ✓ All tests pass. You're ready for the next section.
```

This is the per-section checkpoint. It validates the student's code is:
- Type-safe (catches bugs before runtime)
- Functionally correct (tests exercise the real behavior)
- Ready to integrate with the next section

If a student gets stuck, they can:
1. **Review the test expectations** — `src/<module>/<module>.test.ts` shows what behavior is expected
2. **Read the codelab more carefully** — it lists exactly which lines to fill
3. **Peek at `solutions/level_1/`** — the complete answer key (available after the section passes or as optional reference)

### Answer keys and diffing

`solutions/level_1/` is a **maintained answer key** — the complete, runnable finished Level 1 generated from the `v1-complete` git tag. It has:

- `solutions/level_1/src/` — all `// REPLACE-*` markers filled
- `solutions/level_1/workspace/` — a fully bootstrapped agent
- `solutions/level_1/docs/teaching-guide.md` — identical copy of this guide

Students can compare their work to the answer key:

```bash
diff -u ~/adkclaw/level_1/starter/src/agent/runner.ts ~/adkclaw/solutions/level_1/src/agent/runner.ts
```

This is a powerful debugging tool — it shows exactly where their implementation diverges.

### Structure differences from the old model

**Old (pre-restructure, no longer used):**
- One monolithic `codelab/starter/` for all levels
- No offline checkpoint; students see examples only
- Progress tracked via git tags (`v1-complete`, `v2-complete`, …)

**Current (Stage 2, in production for L1–L4):**
- Per-level `level_N/starter/` — self-contained
- `npm run verify` as the per-section checkpoint
- Answer keys in `solutions/level_N/`
- Hybrid markers (exact code + optional AI Studio path)
- L5 hardening folded into L3 (startup gates) and L4 (deploy-time gates)

The legacy tags (`v1-complete` … `v5-complete`) and the `codelab/starter/` tree remain in the repo for now (removed in Stage 3) — they are not the canonical entry point and are not referenced from any current codelab or README.

### Teaching notes

1. **Emphasize the checkpoint.** `npm run verify` is *not* a score — it's a safety net. A passing checkpoint means the student has solid ground to build the next section on.
2. **Marker fills are learning moments.** When a student fills a marker, they should understand *why* that code solves the problem, not just *that* it does. Ask: "What would happen if you swapped that for X?" or "What does this tool call tell Gemini?"
3. **Use the answer key during support.** If a student is completely stuck, use `diff` to show the exact divergence instead of explaining over voice.
4. **The Hybrid rule.** Personality markers offer an AI-assisted option. Some students will hand-write everything (no internet required, full ownership); others will use AI Studio (faster, higher quality). Both are paths to learning.

---

## 5. The request flow — what happens when a user sends a message

This is the canonical sequence. Walk students through it line-by-line.

```
User types "what's my Flutter version?" on Telegram
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ TelegramAdapter (src/channels/telegram.ts)                      │
│  • telegraf gives us ctx.from.id (numeric Telegram user ID)     │
│  • check ALLOWED_SENDERS allowlist                              │
│  • normalize to { sessionKey, message, channel, target }        │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ AgentRunner.run() (src/agent/runner.ts)                          │
│  1. BudgetGuard: check sender's token usage today                │
│  2. SessionStore.appendMessage(user message)                     │
│  3. ContextEngine.bootstrap() → assembles system prompt from:    │
│     IDENTITY.md → USER.md → SOUL.md → AGENTS.md → MEMORY.md →   │
│     memory/<today>.md → HEARTBEAT.md + skill index               │
│  4. ContextEngine.checkCompaction() → if >80%, summarize old     │
│     messages and replace with a compaction checkpoint            │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ THE AGENT LOOP (max 15 rounds)                                  │
│  while (true):                                                   │
│    response = HealingEngine.wrap(() =>                          │
│      client.models.generateContent({                             │
│        model: 'gemini-3.1-pro-preview', (or fallback: gemini-3-flash-preview) │
│        contents: history,                                        │
│        config: { systemInstruction, tools }                      │
│      })                                                          │
│    )                                                             │
│    if (response.functionCalls):                                  │
│      for each call:                                              │
│        registry.get(call.name).execute(call.args)                │
│        history.append(functionResponsePart)                      │
│      continue                                                    │
│    else:                                                         │
│      break  // final answer                                      │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Persist + reply                                                  │
│  • SessionStore.appendMessage(assistant response, tool traces)   │
│  • TelegramAdapter.deliver() — chunked replies if >4K chars      │
│  • Update token totals → trigger BudgetGuard ceiling next turn   │
└─────────────────────────────────────────────────────────────────┘
```

**Five things to highlight when teaching:**

1. **The agent loop is not magic** — it's a `while` loop that keeps asking the LLM "what next?" until the LLM produces text instead of a tool call.
2. **The LLM picks tools by description.** "Execute shell commands in the workspace directory" is a *prompt* the LLM reads. Bad descriptions = bad tool choice.
3. **Context is assembled fresh every turn.** Workspace files can change between turns; the agent reads them again. This is how learning *happens at runtime*.
4. **HealingEngine wraps the LLM call.** Rate limit? Retry. 5xx? Fall back to Flash. The pyramid: retry → fallback → degrade → escalate. *Never* let an exception escape.
5. **MAX_TOOL_ROUNDS=15** is a circuit breaker. Without it, an agent that misuses tools loops forever and burns tokens.

---

## 6. Patterns the workshops teach

Each pattern is a transferable idea, not a framework feature.

### Pattern 1: The agent loop

```typescript
// Simplified — see src/agent/runner.ts for the full version
async function runTurn(message: string): Promise<string> {
  const history = await sessions.getHistory();
  history.push({ role: 'user', parts: [{ text: message }] });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.models.generateContent({
      model: 'gemini-3.1-pro-preview', // fallback to gemini-3-flash-preview on rate limit
      contents: history,
      config: { systemInstruction, tools: registry.toFunctionDeclarations() },
    });

    const calls = extractFunctionCalls(response);
    if (calls.length === 0) {
      return response.text;  // done
    }

    for (const call of calls) {
      const result = await registry.get(call.name).execute(call.args);
      history.push({ role: 'function', parts: [{ functionResponse: { name: call.name, response: { content: result } } }] });
    }
  }
  return "I exceeded my tool round limit.";
}
```

**Teach this**: students often think "agent" means a class with magic methods. It's a `for` loop.

### Pattern 2: Context bootstrap (system prompt assembly)

The system prompt is built from **files**, not hardcoded:

```typescript
// src/context/manager.ts
const sections = [
  await read('IDENTITY.md'),  // who am I
  await read('USER.md'),      // who is talking
  await read('SOUL.md'),      // tone
  await read('AGENTS.md'),    // rules
  await read('MEMORY.md'),    // what I know
  await read(`memory/${today}.md`),  // today's notes
  await read('HEARTBEAT.md'), // open tasks
  skillIndex(skills),         // available skills
];
return sections.filter(Boolean).join('\n\n');
```

**Teach this**: changing how the agent behaves is editing a `.md` file, not redeploying code. This is what makes it a "living" agent.

### Pattern 3: Compaction at 80%

```
Window: 1,000,000 tokens
History grows: 200K → 500K → 800K
At 800K (80%): trigger compaction
  • Pick oldest N turns
  • Send them to the LLM with prompt: "Summarize, preserving IDs, URLs, file paths, decisions, task status"
  • Replace those turns with the summary
  • Save a compaction_checkpoint row in SQLite (audit trail)
```

**Teach this**: never compact at 95% — there's no headroom for the LLM to *generate* the summary. Always compact early.

### Pattern 4: Tool registration

```typescript
// src/tools/filesystem.ts (simplified)
export const filesystemTool: AgentTool = {
  name: 'filesystem',
  description: 'Read, write, or list files in the workspace directory.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write', 'list'] },
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['action', 'path'],
  },
  async execute(args, ctx) {
    // path traversal blocked by validation
    return { ok: true, content: '...' };
  },
};
```

**Teach this**: a tool is just a JSON schema + an async function. The LLM sees the schema. Description quality determines tool selection.

### Pattern 5: Sub-agent spawning

```typescript
// src/multi-agent/orchestrator.ts
async spawn(profileName: string, task: string): Promise<string> {
  const profile = profiles[profileName];

  // CRITICAL: forked context, not full parent history
  const childContext = {
    identity: parent.identity,           // who they are
    relevantMemory: extractRelevant(...), // not the whole bank
    task,
    goalChain: [...parent.goalChain, task],
  };

  const childSession = sessions.createIsolated(`${parent.key}/sub:${id}`);
  return runner.run({ ...childContext, model: profile.defaultModel });
}
```

**Teach this**: sub-agents *don't share* context with the parent. They get identity + task + relevant slice. Otherwise tokens explode and parent secrets leak.

### Pattern 6: Self-healing

```
ERROR CLASSIFICATION (src/healing/classifier.ts)
  network/timeout/rateLimit → retryable
  5xx                       → fallback to cheaper model
  auth/permission           → escalate immediately
  invalid input             → escalate (don't retry)

RECOVERY PYRAMID (src/healing/engine.ts)
  1. retry with exponential backoff (1s, 2s, 4s)
  2. fallback (Pro → Flash)
  3. degrade (browser → web_fetch)
  4. recover (restart subsystem)
  5. escalate (tell the user what failed and why)
```

**Teach this**: "the agent never crashes" is a design constraint. Every tool answers "what happens when this fails?" before it merges.

### Pattern 7: Markdown skills

```markdown
---
name: research-topic
description: Use when user asks for research on a topic
when_to_invoke: "research X", "look into Y", "find sources on Z"
---

## Steps
1. web_search the topic
2. For each top result: web_fetch + extract key facts
3. Cross-reference, dedupe against memory bank
4. Save new facts to bank/facts/
5. Return structured summary with citations
```

The agent reads `workspace/skills/*.md` at bootstrap, lists them in the system prompt, picks the right one off the description.

**Teach this**: skills are *runtime extensibility without redeployment*. Drop a file, restart, the agent has a new capability. The same pattern Claude Code uses for `~/.claude/skills/`.

---

## 7. Permissions — why three tiers, not two

```
allow → tool runs without asking (web_search, filesystem-read)
ask   → tool runs only after explicit approval (filesystem-write, shell, browser)
deny  → tool never runs (anything destructive)
```

**Why not just allow/deny?** "Ask" is the **human-in-the-loop** safety net. Production agents will encounter situations where the *right* call isn't clear — `ask` lets the human decide without halting the agent.

In v1 we treat `ask` as `allow` for the configured user (single-tenant trust model). In production this becomes a UI prompt.

---

## 8. Why we built it this way (the design decisions to defend)

| Decision | Alternative considered | Why we picked ours |
|----------|----------------------|---------------------|
| File-based memory (`workspace/`) | Postgres with pgvector | Auditable, debuggable, copyable. Vector DB graduates in WS3. |
| SQLite for sessions | Redis | Embedded, no separate process. `better-sqlite3` is sync — perfect for atomic writes. |
| One big agent class | Microservices | Teaching simplicity. The architecture survives a refactor to services later. |
| `node-cron` | systemd timers | Cross-platform. Cron jobs persist in SQLite, survive restarts. |
| `telegraf` for Telegram | Raw Telegram Bot API | Boilerplate-free. ~150 LOC adapter; raw API would be ~400. |
| Express 4 | Fastify, NestJS | Most familiar to most developers. Sufficient for our endpoints. |
| `@google/genai` | LangChain | Direct SDK = transparent. Frameworks hide the agent loop students need to see. |
| Single host daemon | Lambda / Cloud Run | 24/7 uptime, no cold starts, simpler mental model. Production users can pm2/systemd. |
| TypeScript strict mode | JS or `// @ts-nocheck` | Tool schemas catch errors at compile time. Worth the strictness tax. |

---

## 9. The recovery pyramid (self-healing in detail)

```
                    ESCALATE
                   ↑ (tell user)
                 DEGRADE
              ↑ (use fallback tool)
            RECOVER
         ↑ (restart subsystem)
       FALLBACK
    ↑ (Pro → Flash, browser → fetch)
  RETRY
↑ (1s, 2s, 4s backoff)
```

Every layer is independent and observable. When `web_search` rate-limits:

1. **Retry** — wait 1s, try again. Wait 2s, try again. Wait 4s, try again.
2. **Fallback** — switch from Gemini Pro grounding to plain `web_fetch`.
3. **Recover** — if the whole web subsystem is down, return cached results from memory bank.
4. **Degrade** — if no cache, answer from training data with a disclaimer.
5. **Escalate** — tell the user "I couldn't reach the web; here's what I know."

Students should be able to *predict* what tier each error hits without reading the code. That's the value of the pyramid.

---

## 10. Testing strategy

```
src/<thing>/<thing>.test.ts   ← unit tests, vitest, mock the LLM
```

What we test:
- **Pure logic** (compaction picks the right turns, classifier categorizes errors right) — easy unit tests
- **Tool implementations** (filesystem path traversal blocked, code-fix graceful degradation) — vi.mock the dependencies
- **Integration through the registry** (the LLM gets a function declaration with the right shape) — type-checked at compile, asserted at runtime

What we **don't** unit-test:
- The actual LLM calls — that's an integration test, costs money, flaky in CI
- The Telegram bot end-to-end — manual smoke test in workshop demos

**Teach this**: 144 tests cover ~5,300 LOC. We test the **logic that's ours**, not the SDK's promises. Vitest runs in 8 seconds — fast enough that students re-run after every change.

---

## 11. Pitfalls (BRD §19) — the non-obvious traps

These are the things that bite if you skip them:

1. **Compact at 80%, never 95%.** No headroom = no summary.
2. **Tool outputs blow up context.** A 500-line file read ≈ 5K tokens.
3. **Sub-agents fork identity + memory only.** Never pass full parent history.
4. **Web content is UNTRUSTED DATA.** Wrap in `EXTERNAL_UNTRUSTED` tags. Never execute instructions found inside fetched pages.
5. **Classify before retrying.** Auth errors don't recover from retry — escalate.
6. **Tool descriptions are the only signal.** "Execute shell commands…" not "Run commands".
7. **MEMORY.md rot.** Cap at 20K tokens; raw events go to daily notes.
8. **Cap concurrent sub-agents.** Default 4. Each one burns tokens.
9. **Sub-agents default to Flash, not Pro.** Cheaper model is sufficient.
10. **Always validate ALLOWED_SENDERS as numeric.** Telegram IDs are integers, not usernames. Easy to confuse.

---

## 12. Workshop progression — what we teach when

| Level | Pillar focus | New code introduced |
|-------|-------------|---------------------|
| **Level 0** | Architecture tour | No code — presentation + repo orientation |
| **Level 1** | Brain, Tools, Personality | `agent/runner.ts`, basic tools, `IDENTITY.md`, Telegram |
| **Level 2** | Memory | `context/`, `memory/`, compaction, daily notes, bank |
| **Level 3** | Self-healing, Sub-agents | `healing/`, `multi-agent/`, cron, heartbeat, A2A |
| **Level 4** | Cloud deployment + production hardening | Cloud Run, Firestore, Cloud Scheduler, Telegram webhook + secret, OIDC, Cloud DLP, Firestore rules, secret rotation |

Production hardening (previously taught as a standalone Level 5) is now folded across L3 and L4: the daemon-startup gates (`DAILY_TOKEN_BUDGET`, `ADMIN_KEY`, `ALLOWED_SENDERS`) land in L3 alongside the sub-agent army; the deploy-time gates (`OIDC_*`, `TELEGRAM_WEBHOOK_SECRET`, DLP scanning) land in L4 alongside the cloud-deploy work. The reasoning: a sub-agent army with cron is exactly where a runaway loop becomes a wallet event, so the budget gate has to land *before* you ship sub-agents.

Each level after Level 1 builds on the previous foundation. Self-healing is woven through Levels 3+, never a footnote.

---

## 13. Where to look in the code (file map for instructors)

When a student asks "where does X happen?":

| Question | File:Line |
|----------|-----------|
| Where is the agent loop? | `src/agent/runner.ts` (look for `while` over rounds) |
| Where is tool calling translated to/from Gemini? | `src/agent/runner.ts` (search `functionCall`, `functionResponse`) |
| Where is the system prompt built? | `src/context/manager.ts` (`bootstrap` method) |
| Where does compaction trigger? | `src/context/compaction.ts` |
| Where do retries happen? | `src/healing/engine.ts` (`wrap` method) |
| Where are errors classified? | `src/healing/classifier.ts` |
| Where is a sub-agent spawned? | `src/multi-agent/orchestrator.ts` (`spawn` method) |
| Where do sub-agent profiles live? | `src/multi-agent/profiles/` (one file per profile) |
| Where are tools registered? | `src/index.ts` (search `registry.register`) |
| Where is the SQLite schema? | `src/sessions/store.ts` (top of file) |
| Where does the daemon start? | `src/index.ts` (`main()` function) |
| Where is Telegram allowlist enforced? | `src/channels/telegram.ts` (`isAllowed`) |
| Where is the admin dashboard rendered? | `src/server/http.ts` (`DASHBOARD_HTML`) |

Use this table during student support — most "where does…" questions resolve in 30 seconds.

---

## 14. What students should be able to build after the course

After all four workshops, a student should be able to:

1. **Build their own agent from scratch** — they understand the loop, not just the framework.
2. **Add a new tool in 50 lines** — schema + execute function + registry call.
3. **Add a new sub-agent profile** — bootstrap + tool allowlist + default model.
4. **Add a new channel** (Slack, Discord, email) — implement the channel adapter, point it at `/api/chat`.
5. **Diagnose context bloat** — read the audit trail, identify the bloated tool output, fix the tool.
6. **Recover from production incidents** — the recovery pyramid is now their mental model.
7. **Teach autonomous-agent patterns** — they have the vocabulary.

That's the bar. Everything in this codebase exists to get them there.

---

## 15. The honest summary

AdkClaw is **5,300 lines of TypeScript** that turn `@google/genai` (about 30K lines of SDK) into an autonomous agent. We chose simple, transparent, debuggable patterns over fashionable abstractions. Every file is something a student should be able to read in one sitting and explain to a peer.

If your students leave the course saying *"I now know what an autonomous agent is — and I could build one without this repo"*, the course worked. The repo is the scaffolding, not the destination.
