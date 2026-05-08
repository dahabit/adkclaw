author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community)
summary: Wrap a Gemini API call in the core ADK pattern — think → act → observe → respond. Build the agent loop, register three tools, give your agent a name and a personality, and put it on Telegram.
id: adkclaw-codelab-1-build-the-brain
categories: ai,ml,gemini,adk,typescript,nodejs,agents
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 1 — Build the Brain

## Before you begin

In this codelab, you will wrap one Gemini API call in **a loop**, give it three **tools**, hand it a **personality** through markdown files, and put it on **Telegram** so you can talk to it from your phone. This is **Level 1 of 5** in the AdkClaw series — the first level where you write code.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites

- Completed [Level 0 — Architecture Tour](https://github.com/dahabit/adkclaw/tree/main/level_0)
- Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- One previous Gemini API call under your belt (`models.generateContent({...})`)
- A working terminal and editor

### What you will learn

- The core ADK pattern: `think → act → observe → respond` — the agent loop
- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling) in Gemini and the `AgentTool` shape that defines callable tools
- Permission tiers (`allow` / `ask` / `deny`) — the human-in-the-loop pattern
- How three tools (`web_search`, `web_fetch`, `filesystem`) are enough for a real agent
- Personality engineering — `IDENTITY.md` + `SOUL.md` + `agent.yaml` give the agent its voice
- Telegram via [telegraf](https://telegraf.js.org/) and the `/start` self-service ID-discovery pattern
- SQLite session storage keyed by `<channel>:<senderId>` — same agent, multiple users

### What you will need

- A computer with **Node.js 22+** installed (`node --version` ≥ v22.0.0)
- A free [Gemini API key](https://aistudio.google.com/apikey)
- A [Telegram bot token](https://t.me/BotFather) (free; send `/newbot`)
- [Git](https://git-scm.com/)
- The `codelab/starter/` directory you cloned in Level 0 (or clone fresh — see below)

## Introduction

You have used `client.models.generateContent()`. That is a function call, not an agent. Three things separate the two:

1. **The loop** — the LLM may emit *tool calls* instead of text. The runtime runs them, appends the results, and calls the LLM again. Repeat until the model emits text.
2. **Tools** — concrete functions the LLM can invoke: read a file, fetch a URL, search the web. Tools are how the agent acts on the world.
3. **Persistent personality** — system instructions assembled from markdown files in a `workspace/` directory. The agent has a name, a tone, and a backstory that survives reboots.

By the end of this level your agent will speak on Telegram, remember the conversation across turns within a session, and call tools when it needs information. It will not survive a reboot yet — that is Level 2.

### What you will build

By the end of this codelab, you will have:

- An `AgentRunner` class wrapping the Gemini API in a tool-calling loop (capped at 15 rounds)
- A `ToolRegistry` with three tools: `web_search`, `web_fetch`, `filesystem`
- A SQLite-backed `SessionStore` that persists every message
- A Telegram bot that talks to your agent from your phone
- A populated `workspace/` (your agent's personality on disk)
- An HTTP API at `localhost:3000` powering the `adkclaw chat` terminal REPL
- A passing `npm test` (50+ tests across the runner, registry, sessions, context engine)

## 1. Scaffold and verify

If you skipped Level 0, start here. Otherwise jump to Chapter 2.

### Clone the starter

In the **terminal**, run:

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/codelab/starter
```

### Install dependencies and verify the toolchain

```bash
npm install
npm run typecheck
```

**Example output**:

```
> adkclaw@0.1.0 typecheck
> tsc --noEmit
```

A clean exit means the four pre-filled folders compile. You are ready.

**Tip:** if `npm install` is slow, `node_modules` is ~600 MB (Playwright is the bulk). For Level 1 you do not strictly need Playwright; set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to skip the browser binaries.

### Configure the wizard

```bash
npm run setup
```

Follow the prompts. Pick a name (`Dudu`, `Buddy`, anything you like) and tone (`friendly` recommended). Paste your Gemini API key and Telegram bot token when asked.

The wizard writes `.env`, `agent.yaml`, and a populated `workspace/` from the templates.

### Section recap

- The starter has 4 pre-filled folders under `src/` (types, config, cli, index stub) — everything else you will create.
- `npm install && npm run typecheck` is the green-light check before writing any code.
- Reference: [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md) explains why each pre-filled file is what it is.

## 2. Make your first Gemini call

Prove the SDK works before adding any complexity.

### Replace `src/index.ts` with a minimal API call

In your **editor**, open `src/index.ts` and replace the stub with this:

```typescript
// src/index.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Re-run `npm run setup`.');
  }

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: 'Hello, what is your name?',
  });

  console.log(response.text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

In the **terminal**, run:

```bash
npm run dev
```

**Example output** (yours may be a little different):

```
I am an AI assistant created by Google. I do not have a personal name in
the human sense — but I am here to help. What can I do for you today?
```

That works. But it is not an agent — it is a one-shot function call. There is no loop, no tools, no memory. The next chapter wraps this single call in **the loop** that turns it into an agent.

**Important:** if you got `Error: API key is invalid`, re-check your `.env`. The wizard might have appended a stray newline; open `.env` in your editor and verify the key has no leading/trailing whitespace.

### Section recap

- One `generateContent` call is a function call, not an agent.
- The Gemini SDK is reached via `@google/genai` (the [Agent Development Kit (ADK)](https://google.github.io/adk-docs/)).
- Reference: [`src/index.ts`](https://github.com/dahabit/adkclaw/blob/main/src/index.ts) (eventually replaces this minimal version with the full wire-up).

## 3. The agent loop

The core ADK pattern. Once you have this, every other chapter is filling in tools.

### The pattern

```
┌──── user message ─────┐
▼                       │
[ generateContent ]     │
       │                │
       ▼                │
function calls?         │
  ├── YES → run → append → ┘ (loop)
  └── NO  → return text
```

The LLM may emit **tool calls** instead of text. The runtime runs each call, appends the result back to the conversation, then calls the LLM again. The loop ends when the model emits text instead of more tool calls.

### Create `src/agent/runner.ts`

In the **terminal**:

```bash
mkdir -p src/agent
```

In your **editor**, create `src/agent/runner.ts`:

```typescript
// src/agent/runner.ts
import { GoogleGenAI, type Content, type FunctionCall, type Part } from '@google/genai';
import type { Config, ToolContext } from '../types/index.js';
import type { ToolRegistry } from '../tools/registry.js';

const MAX_TOOL_ROUNDS = 15; // safety circuit breaker

export interface RunRequest {
  sessionKey: string;
  systemPrompt: string;
  history: Content[];
  userText: string;
  workspacePath: string;
}

export interface RunResult {
  reply: string;
  toolCalls: number;
  rounds: number;
  newHistory: Content[];
}

export class AgentRunner {
  constructor(
    private readonly client: GoogleGenAI,
    private readonly registry: ToolRegistry,
    private readonly config: Config,
  ) {}

  async run(req: RunRequest): Promise<RunResult> {
    const history: Content[] = [
      ...req.history,
      { role: 'user', parts: [{ text: req.userText }] },
    ];

    let toolCalls = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.models.generateContent({
        model: this.config.agent.defaultModel,
        contents: history,
        config: {
          systemInstruction: req.systemPrompt,
          tools: [{ functionDeclarations: this.registry.toFunctionDeclarations() }],
        },
      });

      const calls: FunctionCall[] = response.functionCalls ?? [];

      if (calls.length === 0) {
        const text = response.text ?? '';
        history.push({ role: 'model', parts: [{ text }] });
        return { reply: text, toolCalls, rounds: round + 1, newHistory: history };
      }

      // Append the model's tool-call request
      const modelParts: Part[] = calls.map((call) => ({ functionCall: call }));
      history.push({ role: 'model', parts: modelParts });

      // Run each call and append the response
      const responseParts: Part[] = [];
      for (const call of calls) {
        toolCalls++;
        const ctx: ToolContext = {
          sessionKey: req.sessionKey,
          workspacePath: req.workspacePath,
        };
        const result = await this.registry.invoke(call.name ?? '', call.args ?? {}, ctx);
        responseParts.push({
          functionResponse: { name: call.name ?? '', response: { result } },
        });
      }
      history.push({ role: 'user', parts: responseParts });
    }

    return {
      reply: '(Tool round limit reached — stopping for safety.)',
      toolCalls,
      rounds: MAX_TOOL_ROUNDS,
      newHistory: history,
    };
  }
}
```

### Create `src/tools/registry.ts`

```bash
mkdir -p src/tools
```

```typescript
// src/tools/registry.ts
import type { AgentTool, ToolContext, ToolResult } from '../types/index.js';

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  toFunctionDeclarations() {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async invoke(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { error: `Unknown tool: ${name}` };
    }
    if (tool.permission === 'deny') {
      return { error: `Tool denied by policy: ${name}` };
    }
    try {
      return await tool.execute(args as Record<string, unknown>, ctx);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
```

**Tip:** the `MAX_TOOL_ROUNDS = 15` constant is your safety circuit breaker. If a tool description is wrong or the model misbehaves, the agent could loop forever. The cap is a non-negotiable guard rail.

### Section recap

- The agent loop is a `for` loop. Each iteration: call the model, extract tool calls, run them, append, loop.
- The loop ends when the LLM emits text instead of a tool call.
- `MAX_TOOL_ROUNDS=15` is the circuit breaker — without it a misbehaving agent runs forever.
- Reference: [`src/agent/runner.ts`](https://github.com/dahabit/adkclaw/blob/main/src/agent/runner.ts) is the production version (with `HealingEngine` integration that lands in Level 3).

## 4. Three core tools

An agent without tools is a chatbot. Here are the three minimums.

### Create `src/tools/web.ts`

```typescript
// src/tools/web.ts
import type { AgentTool } from '../types/index.js';

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    'Search Google for current, factual information. Use for news, recent ' +
    'events, version numbers, or anything time-sensitive. Returns cited results.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  async execute({ query }) {
    // For Gemini's built-in grounding, the search happens server-side via the
    // googleSearchRetrieval feature. For this MVP we return a stub; the
    // production version uses the grounding API.
    return {
      results: [
        { snippet: `(stub) results for "${query}"`, url: 'https://example.com' },
      ],
    };
  },
};

export const webFetchTool: AgentTool = {
  name: 'web_fetch',
  description:
    'Fetch the contents of a public URL and return them as plain text. ' +
    'Use this when the user gives you a URL to summarize or extract data from.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  async execute({ url }) {
    const res = await fetch(String(url));
    if (!res.ok) {
      return { error: `HTTP ${res.status} for ${url}` };
    }
    const text = await res.text();
    return { text: text.slice(0, 16_000) }; // cap response
  },
};
```

### Create `src/tools/filesystem.ts`

```typescript
// src/tools/filesystem.ts
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import type { AgentTool } from '../types/index.js';

function safePath(workspacePath: string, raw: string): string {
  const target = normalize(resolve(workspacePath, raw));
  if (!target.startsWith(workspacePath)) {
    throw new Error(`Path escapes workspace: ${raw}`);
  }
  return target;
}

export const filesystemTool: AgentTool = {
  name: 'filesystem',
  description:
    'Read, write, or list files inside the workspace directory. Use this for ' +
    'persistent notes, drafts, and reference files. Cannot reach files outside ' +
    'the workspace.',
  permission: 'ask',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write', 'list'] },
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['action', 'path'],
  },
  async execute({ action, path, content }, ctx) {
    const target = safePath(ctx.workspacePath, String(path));
    if (action === 'read') {
      const text = await readFile(target, 'utf8');
      return { text };
    }
    if (action === 'write') {
      await mkdir(resolve(target, '..'), { recursive: true });
      await writeFile(target, String(content ?? ''), 'utf8');
      return { ok: true, bytes: String(content ?? '').length };
    }
    if (action === 'list') {
      const entries = await readdir(target, { withFileTypes: true });
      return {
        entries: entries.map((e) => ({
          name: e.name,
          kind: e.isDirectory() ? 'dir' : 'file',
        })),
      };
    }
    return { error: `Unknown action: ${action}` };
  },
};
```

### Create `src/tools/index.ts`

```typescript
// src/tools/index.ts
import type { ToolRegistry } from './registry.js';
import { webSearchTool, webFetchTool } from './web.js';
import { filesystemTool } from './filesystem.js';

export function registerCoreTools(registry: ToolRegistry) {
  registry.register(webSearchTool);
  registry.register(webFetchTool);
  registry.register(filesystemTool);
}
```

**Important:** the tool's `description` field is the **only signal** the LLM has when picking which tool to call. Compare:

- ❌ `"description": "Run commands"` — the LLM has no idea what this does, when to call it, or what it returns
- ✅ `"description": "Run shell commands inside the workspace directory. Returns stdout, stderr, and exit code as JSON."` — clear scope, output shape, and constraints

Spend more time on descriptions than feels necessary. Bad descriptions are the #1 reason agents pick the wrong tool.

### Section recap

- Three tools is the minimum: read the web, fetch a URL, read/write files.
- Permission tiers (`allow`, `ask`, `deny`) are how you control destructive actions.
- The `description` field is load-bearing. Treat it as documentation for the LLM, not for humans.
- Reference: [`src/tools/registry.ts`](https://github.com/dahabit/adkclaw/blob/main/src/tools/registry.ts), [`src/tools/web-search.ts`](https://github.com/dahabit/adkclaw/blob/main/src/tools/web-search.ts), [`src/tools/filesystem.ts`](https://github.com/dahabit/adkclaw/blob/main/src/tools/filesystem.ts).

## 5. Personality on disk

The `workspace/` directory is your agent's brain on disk. Each turn, the runtime reads a fixed list of markdown files and stitches them into the system prompt. To change your agent's behavior, you edit Markdown — no daemon restart required.

### The personality stack

| File | Purpose |
|------|---------|
| `IDENTITY.md` | Who the agent is — name, role, backstory |
| `SOUL.md` | How it talks — tone, quirks, what it loves |
| `USER.md` | About the human it talks to — your name, your context |
| `AGENTS.md` | Behavioral rules — what it will not do, how it asks for permission |
| `MEMORY.md` | Long-term curated memory (cap ~20 K tokens — Level 2 grows this) |
| `agent.yaml` | Machine-readable identity (`name`, `tone`, `traits`) |

The wizard you ran in Chapter 1 already populated these from the `workspace.example/` templates. Open them in your editor and customize.

### Open `workspace/SOUL.md`

```markdown
# {{AGENT_NAME}}'s Soul

You are {{AGENT_NAME}} — but that is just your codename. If {{USER_NAME}}
gives you a nickname like Dudu, Buddy, or Coco, embrace it warmly. Your
real name is whatever they call you.

You are warm, direct, and honest about uncertainty. Use humor sparingly. When
you do not know something, say so and offer to find out.
```

The wizard substituted `{{AGENT_NAME}}` and `{{USER_NAME}}` based on your answers. Edit this file to match your agent's voice. The next turn picks up the change — no restart.

### Build the context engine

In the **terminal**:

```bash
mkdir -p src/context
```

Create `src/context/manager.ts`:

```typescript
// src/context/manager.ts
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const CORE_FILES = [
  'IDENTITY.md',
  'USER.md',
  'SOUL.md',
  'AGENTS.md',
  'MEMORY.md',
];

export class ContextEngine {
  private cache: { fingerprint: string; prompt: string } | null = null;

  constructor(private readonly workspacePath: string) {}

  bootstrap(): string {
    const fingerprint = this.computeFingerprint();
    if (this.cache?.fingerprint === fingerprint) {
      return this.cache.prompt;
    }

    const sections: string[] = [];
    for (const file of CORE_FILES) {
      const path = resolve(this.workspacePath, file);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8').trim();
      if (text) sections.push(text);
    }

    const prompt = sections.join('\n\n---\n\n');
    this.cache = { fingerprint, prompt };
    return prompt;
  }

  private computeFingerprint(): string {
    const parts: string[] = [];
    for (const file of CORE_FILES) {
      const path = resolve(this.workspacePath, file);
      if (!existsSync(path)) continue;
      parts.push(`${file}:${statSync(path).mtimeMs}`);
    }
    return parts.join('|');
  }
}
```

The mtime fingerprint means an edit to a workspace file invalidates the cache on the next turn — no restart needed.

### Section recap

- Personality lives in `workspace/*.md` files, not in source code.
- `ContextEngine.bootstrap()` reads them in fixed order on every turn (cached by mtime).
- The first turn after editing a workspace file picks up the change automatically.
- Reference: [`src/context/manager.ts`](https://github.com/dahabit/adkclaw/blob/main/src/context/manager.ts) (production version reads more files for Level 2's bank + skills).

## 6. Sessions and channels — Telegram + CLI

An agent in your terminal is not autonomous. Telegram puts it in your pocket.

### Create `src/sessions/store.ts`

```bash
mkdir -p src/sessions
```

```typescript
// src/sessions/store.ts
import Database, { type Database as DB } from 'better-sqlite3';
import type { Content } from '@google/genai';

export class SessionStore {
  private readonly db: DB;

  constructor(databasePath: string) {
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        key TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT NOT NULL,
        role TEXT NOT NULL,
        content_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_key) REFERENCES sessions(key)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key);
    `);
  }

  ensureSession(channel: string, senderId: string): string {
    const key = `${channel}:${senderId}`;
    const now = Date.now();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO sessions (key, channel, sender_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(key, channel, senderId, now, now);
    return key;
  }

  history(sessionKey: string): Content[] {
    const rows = this.db
      .prepare(
        `SELECT content_json FROM messages WHERE session_key = ? ORDER BY id ASC`,
      )
      .all(sessionKey) as Array<{ content_json: string }>;
    return rows.map((r) => JSON.parse(r.content_json) as Content);
  }

  appendAll(sessionKey: string, contents: Content[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO messages (session_key, role, content_json, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    const tx = this.db.transaction(() => {
      for (const c of contents) {
        stmt.run(sessionKey, c.role ?? 'user', JSON.stringify(c), now);
      }
      this.db
        .prepare(`UPDATE sessions SET updated_at = ? WHERE key = ?`)
        .run(now, sessionKey);
    });
    tx();
  }
}
```

Session keys are `<channel>:<senderId>` — same agent, multiple users, no leakage. SQLite via `better-sqlite3` is synchronous, embedded, and zero-config.

### Create `src/channels/telegram.ts`

```bash
mkdir -p src/channels
```

```typescript
// src/channels/telegram.ts
import { Telegraf, type Context } from 'telegraf';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';

const MAX_MESSAGE_LENGTH = 4000;

export class TelegramAdapter {
  private readonly bot: Telegraf;

  constructor(
    private readonly config: Config,
    private readonly runner: AgentRunner,
    private readonly contextEngine: ContextEngine,
    private readonly sessions: SessionStore,
  ) {
    this.bot = new Telegraf(config.telegram.botToken);

    // The /start command — students send this to discover their numeric ID
    this.bot.start(async (ctx) => {
      const id = ctx.from?.id;
      await ctx.reply(
        `Welcome! Your Telegram numeric ID is *${id}*.\n\n` +
          `Add it to ALLOWED_SENDERS in your .env, restart, and I will talk back.`,
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.on('text', (ctx) => this.handleMessage(ctx));
  }

  private async handleMessage(ctx: Context) {
    const senderId = ctx.from?.id;
    if (!senderId) return;

    const senderIdStr = String(senderId);
    if (!this.config.telegram.allowedSenders.includes(senderIdStr)) {
      console.log(`[telegram] rejected sender ${senderIdStr}`);
      return; // silent reject
    }

    const text = (ctx.message as { text?: string })?.text ?? '';
    if (!text) return;

    const sessionKey = this.sessions.ensureSession('telegram', senderIdStr);
    const history = this.sessions.history(sessionKey);

    const result = await this.runner.run({
      sessionKey,
      systemPrompt: this.contextEngine.bootstrap(),
      history,
      userText: text,
      workspacePath: this.config.workspacePath,
    });

    this.sessions.appendAll(sessionKey, result.newHistory.slice(history.length));

    // Telegram caps messages at ~4000 chars — chunk if needed
    let reply = result.reply || '(no reply)';
    while (reply.length > 0) {
      const chunk = reply.slice(0, MAX_MESSAGE_LENGTH);
      await ctx.reply(chunk);
      reply = reply.slice(MAX_MESSAGE_LENGTH);
    }
  }

  async launch() {
    await this.bot.launch();
    console.log('[telegram] bot online');
  }
}
```

**Important:** `ALLOWED_SENDERS` must contain **numeric IDs**, not `@username`. Telegram's API only sends numeric IDs to bots. Setting `ALLOWED_SENDERS=dahabdev` looks right but silently rejects every message.

### Create `src/server/http.ts`

```bash
mkdir -p src/server
```

```typescript
// src/server/http.ts
import express, { type Express } from 'express';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';

export function createHttpServer(
  config: Config,
  runner: AgentRunner,
  contextEngine: ContextEngine,
  sessions: SessionStore,
): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/chat', async (req, res) => {
    const { senderId, text } = req.body as { senderId?: string; text?: string };
    if (!senderId || !text) {
      return res.status(400).json({ error: 'senderId and text required' });
    }

    const sessionKey = sessions.ensureSession('cli', senderId);
    const history = sessions.history(sessionKey);

    try {
      const result = await runner.run({
        sessionKey,
        systemPrompt: contextEngine.bootstrap(),
        history,
        userText: text,
        workspacePath: config.workspacePath,
      });
      sessions.appendAll(sessionKey, result.newHistory.slice(history.length));
      res.json({ reply: result.reply, toolCalls: result.toolCalls });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return app;
}
```

### Wire it all together — replace `src/index.ts` with the full version

```typescript
// src/index.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { loadConfig } from './config/index.js';
import { ContextEngine } from './context/manager.js';
import { ToolRegistry } from './tools/registry.js';
import { registerCoreTools } from './tools/index.js';
import { AgentRunner } from './agent/runner.js';
import { SessionStore } from './sessions/store.js';
import { TelegramAdapter } from './channels/telegram.js';
import { createHttpServer } from './server/http.js';

async function main() {
  const config = loadConfig({ cwd: process.cwd() });

  const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const registry = new ToolRegistry();
  registerCoreTools(registry);

  const sessions = new SessionStore(config.databasePath);
  const contextEngine = new ContextEngine(config.workspacePath);
  const runner = new AgentRunner(client, registry, config);

  const app = createHttpServer(config, runner, contextEngine, sessions);
  app.listen(config.server.port, () => {
    console.log(`[http] listening on http://localhost:${config.server.port}`);
  });

  if (config.telegram.botToken) {
    const tg = new TelegramAdapter(config, runner, contextEngine, sessions);
    await tg.launch();
  }

  console.log(`🤖 ${config.agent.name} is online.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Run it

In the **terminal**:

```bash
npm run dev
```

**Example output**:

```
[http] listening on http://localhost:3000
[telegram] bot online
🤖 Dudu is online.
```

### Test on Telegram

1. Open Telegram, find your bot (the one whose token you pasted), send `/start`.
2. The bot replies with your numeric ID.
3. Edit `.env`: set `ALLOWED_SENDERS=<your-numeric-id>`.
4. Restart the daemon (`Ctrl+C`, then `npm run dev`).
5. Send a message: `Hi, I am Ahmed. Can I name you Dudu?`
6. The agent embraces the nickname (because `SOUL.md` allows it).

### Test the CLI REPL

In a second **terminal**, with the daemon still running:

```bash
npm run chat
```

Same agent, terminal interface. Same memory across both channels (session is per-channel-per-user, but `workspace/USER.md` is shared).

### Section recap

- Sessions are keyed `<channel>:<senderId>` — same agent, multiple users.
- Telegram is one channel, the CLI REPL is another. Both POST to `/api/chat`.
- The `/start` self-service ID-discovery pattern is the cleanest way to onboard.
- Reference: [`src/sessions/store.ts`](https://github.com/dahabit/adkclaw/blob/main/src/sessions/store.ts), [`src/channels/telegram.ts`](https://github.com/dahabit/adkclaw/blob/main/src/channels/telegram.ts), [`src/server/http.ts`](https://github.com/dahabit/adkclaw/blob/main/src/server/http.ts).

## Congratulations!

You have built your first autonomous agent — one that runs on Telegram, calls real tools, holds conversation memory, and embraces whatever nickname you give it.

### Recap

In this codelab you:

- Wrote the agent loop — a `for` loop that calls Gemini, runs tool calls, and feeds results back
- Registered three core tools (`web_search`, `web_fetch`, `filesystem`) with permission tiers
- Built a `ContextEngine` that assembles the system prompt from markdown files in `workspace/`
- Created a SQLite session store keyed by `<channel>:<senderId>`
- Wired Telegram (telegraf) and an HTTP API for the terminal REPL
- Talked to your agent from your phone

### Continued experimentation

Try these before moving on to Level 2:

- Add a fourth tool — `weather(city: string)` — that fetches the current weather. Hint: use `wttr.in`.
- Edit `workspace/SOUL.md` and watch the agent's voice change on the next turn.
- Send a long message and see how the agent handles `MAX_TOOL_ROUNDS=15` if you trigger it (rare, but instructive).
- Open `data/adkclaw.db` with `sqlite3` and run `SELECT * FROM messages LIMIT 10` — see your conversation in raw form.

### What is next

- **[Level 2 — Memory & Skills](https://github.com/dahabit/adkclaw/tree/main/level_2)** — your agent forgets you the moment a session expires. Time to give it a real memory.
- The full reference implementation: [github.com/dahabit/adkclaw](https://github.com/dahabit/adkclaw)
- Architecture deep-dive: [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md)
- Live cohort fleet: [adkclaw.dev](https://adkclaw.dev) — your beacon should now be lit (Level 1 badge unlocked).

### Resources

- [Google ADK documentation](https://google.github.io/adk-docs/)
- [Gemini API function calling guide](https://ai.google.dev/gemini-api/docs/function-calling)
- [Gemini API grounding guide](https://ai.google.dev/gemini-api/docs/grounding)
- [The AdkClaw repository](https://github.com/dahabit/adkclaw)
- [Other ADK codelabs](https://codelabs.developers.google.com/?text=adk)
- [Building AI Agents with ADK: The Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) — Google's official starter (Python; same patterns)

---

*This codelab is provided under [Creative Commons 4.0](https://creativecommons.org/licenses/by/4.0/). The AdkClaw repository is licensed under [Apache 2.0](https://github.com/dahabit/adkclaw/blob/main/LICENSE).*

*Authored by Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community.*
