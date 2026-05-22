author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community)
summary: Wrap a Gemini API call in the core ADK pattern — think → act → observe → respond. Build the agent loop, register three tools, give your agent a name and a personality, and put it on Telegram.
id: adkclaw-codelab-2-build-the-brain
categories: ai,ml,gemini,adk,typescript,nodejs,agents
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 2 — Build the Brain

## Before you begin

In this codelab, you will wrap one Gemini API call in **a loop**, give it three **tools**, hand it a **personality** through markdown files, and put it on **Telegram** so you can talk to it from your phone. This is **Level 2 of 5** in the AdkClaw series — the first level where you write code.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites checklist

Before starting, verify you have:

- ✓ Completed [Level 1 — Architecture Tour](https://github.com/dahabit/adkclaw/tree/main/level_1)
- ✓ Node.js 22 or later (`node --version` ≥ v22.0.0)
- ✓ A free [Gemini API key](https://aistudio.google.com/apikey) ready to paste
- ✓ A [Telegram bot token](https://t.me/BotFather) (send `/newbot` to @BotFather; free)
- ✓ [Git](https://git-scm.com/) installed
- ✓ A text editor (VS Code, Vim, etc.)
- ✓ Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) basics

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
- The `level_2/starter/` directory you cloned in Level 1 (or clone fresh — see below)

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
- A clean `npm run build` and `npm run typecheck`, with the pre-filled `npm test` suites still green

## 1. Scaffold and verify

If you skipped Level 1, start here. Otherwise jump to Chapter 2.

### Clone the starter

In the **terminal**, run:

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/level_2/starter
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

### Verify the starter compiles and tests pass

Before you write any code, verify that the starter's type checks and tests pass. The starter comes with `//REPLACE-*` markers standing in for code you will write in the chapters ahead.

```bash
npm run verify
```

**Example output**:

```
> adkclaw@0.1.0 verify
> tsc --noEmit && vitest run

✓ src/config/index.test.ts (1 test)
✓ src/cli/setup.test.ts (2 tests)
```

The verify step type-checks the project (`tsc --noEmit`) and runs the test suite offline (`vitest run` — no Gemini key or network needed). A green pass at this stage confirms the starter skeleton compiles and the pre-filled modules are correct. As you fill in the `//REPLACE-*` markers in each chapter, `npm run verify` is your checkpoint — it should stay green.

### Configure the wizard

```bash
npm run setup
```

Follow the prompts. Pick a name (`Dudu`, `Buddy`, anything you like) and tone (`friendly` recommended). Paste your Gemini API key and Telegram bot token when asked.

The wizard writes `.env`, `agent.yaml`, and a populated `workspace/` from the templates.

### ✅ Section recap

By the end of this section you will:
- Have a clean `npm run typecheck` and `npm run verify` confirming the starter compiles.
- Have a `.env` file with your Gemini API key and Telegram bot token.
- Have `agent.yaml` and a populated `workspace/` with your agent's name and tone.

**Key takeaway:** The starter has 4 pre-filled folders under `src/` (types, config, cli, index stub) — everything else is a `//REPLACE-*` marker you will fill in.

## 2. Make your first Gemini call

Prove the SDK works before adding any complexity.

### Create a scratch file and test the Gemini API

In your **editor**, create a new file `src/hello-gemini.ts` with this content:

```typescript
// src/hello-gemini.ts
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
npx tsx src/hello-gemini.ts
```

**Example output** (yours may be a little different):

```
I am an AI assistant created by Google. I do not have a personal name in
the human sense — but I am here to help. What can I do for you today?
```

That works. But it is not an agent — it is a one-shot function call. There is no loop, no tools, no memory. The next chapter wraps a single call in **the loop** that turns it into an agent.

> ⚠️ **Watch out:** if you got `Error: API key is invalid`, re-check your `.env`. The wizard might have appended a stray newline; open `.env` in your editor and verify the key has no leading/trailing whitespace.

### Clean up

Delete the scratch file — you no longer need it. The real entry point is `src/index.ts` (which you'll complete in §6 by replacing the `//REPLACE-MAIN-ENTRY` marker).

```bash
rm src/hello-gemini.ts
npm run verify
```

The verify should still pass green.

### ✅ Section recap

By the end of this section you will:
- Confirm the Gemini SDK is reachable and your API key works.
- Understand the difference between a one-shot `generateContent()` call and an agent loop.

**Key takeaway:** A single function call is not an agent — you need a loop that runs tools and feeds results back.

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

### Open `src/agent/runner.ts` and fill the agent loop

In your **editor**, open `src/agent/runner.ts`. You will see the class skeleton with an `async run()` method marked with `//REPLACE-AGENT-LOOP`. Replace the marker and the throwing stub with this implementation:

```typescript
    const history: Content[] = [...req.history, { role: 'user', parts: [{ text: req.userText }] }];
    let toolCalls = 0;

    const sdkTools: Array<{ functionDeclarations: object[] }> = [
      { functionDeclarations: this.registry.toFunctionDeclarations() },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.models.generateContent({
        model: this.config.gemini.defaultModel,
        contents: history,
        config: { systemInstruction: req.systemPrompt, tools: sdkTools },
      });

      const calls: FunctionCall[] = response.functionCalls ?? [];

      // No tool calls? The model is done — return its text answer.
      if (calls.length === 0) {
        const text = response.text ?? '';
        history.push({ role: 'model', parts: [{ text }] });
        return { reply: text, toolCalls, rounds: round + 1, newHistory: history };
      }

      // Otherwise: record the request, run each tool, append the responses.
      history.push({ role: 'model', parts: calls.map((call) => ({ functionCall: call })) });

      const responseParts: Part[] = [];
      for (const call of calls) {
        toolCalls++;
        const ctx: ToolContext = {
          session: req.session,
          workspacePath: this.config.paths.workspace,
          config: this.config,
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
```

### Open `src/tools/registry.ts` and fill the registry methods

In your **editor**, open `src/tools/registry.ts`. You will see the class skeleton with a `//REPLACE-TOOL-REGISTRY` marker over the `toFunctionDeclarations()` and `invoke()` methods. Replace both method bodies (after the comment, before the closing brace of each) with these implementations:

**For `toFunctionDeclarations()`**:
```typescript
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
```

**For `async invoke()`**:
```typescript
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
```

> 🎯 **Goal:** the `MAX_TOOL_ROUNDS = 15` constant is your safety circuit breaker. If a tool description is wrong or the model misbehaves, the agent could loop forever. The cap is a non-negotiable guard rail.

### Verify your progress

In the **terminal**, run:

```bash
npm run verify
```

The type-checker confirms the loop and registry compile correctly. Tests still pass.

### ✅ Section recap

By the end of this section you will:
- Understand the `think → act → observe → respond` loop: call the model, extract tool calls, run them, append results, loop until the model returns text.
- See the loop in action: each iteration tracks round count and tool calls.
- Implement the `ToolRegistry` to convert tool objects into Gemini function declarations.

**Key takeaway:** The agent loop ends when the LLM emits text instead of a tool call. `MAX_TOOL_ROUNDS=15` is the circuit breaker — without it a misbehaving agent runs forever.

## 4. Three core tools

An agent without tools is a chatbot. Here are the three minimums.

### Open `src/tools/web.ts` and fill both tool implementations

In your **editor**, open `src/tools/web.ts`. You will see the tool skeletons with a `//REPLACE-TOOL-WEB` marker. Replace the `async execute` body of **both** `webSearchTool` and `webFetchTool` with these implementations:

**For `webSearchTool.execute()`**:
```typescript
    const query = String(args.query ?? '');
    if (!query) return { error: 'query is required' };
    // Stub for now — returns a placeholder so you can see the loop wire
    // through end-to-end. Level 3 swaps this for Gemini search grounding.
    return {
      success: true,
      result: `(stub) search results for "${query}". Level 3 wires real grounding.`,
    };
```

**For `webFetchTool.execute()`**:
```typescript
    const url = String(args.url ?? '');
    if (!url) return { error: 'url is required' };
    const res = await fetch(url);
    if (!res.ok) return { error: `HTTP ${res.status} for ${url}` };
    const text = await res.text();
    return { success: true, result: text.slice(0, 16_000) };
```

### Open `src/tools/filesystem.ts` and fill the filesystem tool

In your **editor**, open `src/tools/filesystem.ts`. You will see the tool skeleton with a `//REPLACE-TOOL-FILESYSTEM` marker. Replace the `async execute` body with this implementation:

```typescript
    const action = String(args.action ?? '');
    const target = safePath(ctx.workspacePath, String(args.path ?? ''));

    if (action === 'read') {
      const text = await readFile(target, 'utf8');
      return { success: true, result: text };
    }
    if (action === 'write') {
      await mkdir(resolve(target, '..'), { recursive: true });
      const content = String(args.content ?? '');
      await writeFile(target, content, 'utf8');
      return { success: true, result: `Wrote ${content.length} bytes.` };
    }
    if (action === 'list') {
      const entries = await readdir(target, { withFileTypes: true });
      const lines = entries.map((e) => `${e.isDirectory() ? 'dir ' : 'file'}  ${e.name}`);
      return { success: true, result: lines.join('\n') || '(empty)' };
    }
    return { error: `Unknown action: ${action}` };
```

Note: the `safePath()` helper is already defined in the file — it prevents directory-traversal attacks by ensuring all operations stay inside the workspace.

### Open `src/tools/index.ts` and fill the tool registration

In your **editor**, open `src/tools/index.ts`. You will see the `registerCoreTools()` function with a `//REPLACE-TOOL-REGISTER` marker. Replace the function body with this implementation:

```typescript
  registry.register(webSearchTool);
  registry.register(webFetchTool);
  registry.register(filesystemTool);
```

> ❌ **Common pitfall:** the tool's `description` field is the **only signal** the LLM has when picking which tool to call.
> - Bad: `"description": "Run commands"` — unclear scope, output, constraints
> - Good: `"description": "Read files inside the workspace. Returns full file contents or an error."` — clear scope, output, and boundaries

Spend more time on descriptions than feels necessary. Bad descriptions are the #1 reason agents pick the wrong tool.

### Verify your progress

In the **terminal**, run:

```bash
npm run verify
```

The type-checker confirms all three tools compile and wire together correctly. Tests still pass.

### ✅ Section recap

By the end of this section you will:
- Register three tools: `web_search`, `web_fetch`, `filesystem`.
- Understand how the `ToolRegistry` converts tool definitions into Gemini function declarations.
- See how the `invoke()` method runs tools, catches errors, and returns results.

**Key takeaway:** Three tools is the minimum for a useful agent: search the web, fetch a URL, and read/write files. The `description` field is load-bearing — it is how the LLM decides which tool to call.

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

The wizard you ran in Chapter 1 already populated these from the `workspace.example/` templates. You will now customize them using one of two approaches: the Hybrid AI-Studio path (optional) or hand-writing.

### Customize `workspace/SOUL.md` and `IDENTITY.md` — Two Paths

#### Path 1: Hybrid AI-Studio (Optional)

If you want the AI to help draft your agent's personality, paste this prompt into **[Gemini at aistudio.google.com](https://aistudio.google.com/)** (with your Gemini API key already added):

```
I am building an agent named [YOUR_AGENT_NAME] with tone [YOUR_TONE].
My name is [YOUR_NAME].

Draft two markdown files:

1. SOUL.md — [YOUR_AGENT_NAME]'s voice, personality, and philosophy (tone, quirks, what it values)
2. IDENTITY.md — [YOUR_AGENT_NAME]'s origin story, context, and role (who it is, what it does)

Each file should be 50–100 words. Use a conversational, direct voice. No placeholders.
```

Copy the output, paste it into `workspace/SOUL.md` and `workspace/IDENTITY.md` in your editor, and skip to "Verify your progress" below.

#### Path 2: Write It Yourself (Fallback)

In your **editor**, open `workspace/SOUL.md` and `workspace/IDENTITY.md`. The starter shipped templates — each file begins with a `<!-- REPLACE-AGENT-PERSONALITY -->` HTML comment marker. Replace that marker and the template content below it with your own voice. The templates look like this:

**SOUL.md**:
```markdown
# {{AGENT_NAME}}'s Soul

You are {{AGENT_NAME}} — but that is just your codename. If {{USER_NAME}}
gives you a nickname like Dudu, Buddy, or Coco, embrace it warmly. Your
real name is whatever they call you.

You are warm, direct, and honest about uncertainty. Use humor sparingly. When
you do not know something, say so and offer to find out.
```

Replace the templates with your own voice. The `{{AGENT_NAME}}` and `{{USER_NAME}}` placeholders are hints — rewrite them as actual names or remove them. Make it sound like your agent talking to you.

> ℹ️ **Note:** the next turn picks up the change — no restart needed. The `ContextEngine` caches personality files by mtime fingerprint.

### Open `src/context/manager.ts` and fill the context engine

In your **editor**, open `src/context/manager.ts`. You will see the `ContextEngine` class with a `//REPLACE-CONTEXT-BOOTSTRAP` marker over the `bootstrap()` method. Replace the method body with this implementation:

```typescript
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
```

The `computeFingerprint()` helper is already defined. The mtime fingerprint means edits to workspace files invalidate the cache on the next turn — no daemon restart needed.

### Verify your progress

In the **terminal**, run:

```bash
npm run verify
```

The type-checker confirms the context engine compiles correctly. Tests still pass.

### ✅ Section recap

By the end of this section you will:
- Understand the personality stack: `IDENTITY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, `MEMORY.md`, and `agent.yaml`.
- Have customized your agent's voice via `SOUL.md` and `IDENTITY.md`.
- See how `ContextEngine.bootstrap()` assembles the system prompt on every turn.

**Key takeaway:** Personality lives in `workspace/*.md` files, not in source code. Edit a workspace file, and the change is live on the next turn — no restart needed.

## 6. Sessions and channels — Telegram + CLI

An agent in your terminal is not autonomous. Telegram puts it in your pocket.

### Open `src/sessions/store.ts` and fill the session storage methods

In your **editor**, open `src/sessions/store.ts`. You will see the class skeleton with a `//REPLACE-SESSION-STORE` marker over the `history()` and `appendAll()` methods. Replace both method bodies with these implementations:

**For `history()`**:
```typescript
    const rows = this.db
      .prepare(`SELECT content_json FROM messages WHERE session_key = ? ORDER BY id ASC`)
      .all(sessionKey) as Array<{ content_json: string }>;
    return rows.map((r) => JSON.parse(r.content_json) as Content);
```

**For `appendAll()`**:
```typescript
    const stmt = this.db.prepare(
      `INSERT INTO messages (session_key, role, content_json, created_at) VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    const tx = this.db.transaction(() => {
      for (const c of contents) {
        stmt.run(sessionKey, c.role ?? 'user', JSON.stringify(c), now);
      }
      this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE key = ?`).run(now, sessionKey);
    });
    tx();
```

Session keys are `<channel>:<senderId>` — same agent, multiple users, no leakage. SQLite via `better-sqlite3` is synchronous, embedded, and zero-config.

### Open `src/channels/telegram.ts` and fill the Telegram handler

In your **editor**, open `src/channels/telegram.ts`. You will see the class skeleton with a `//REPLACE-CHANNEL-TELEGRAM` marker over the `handleMessage()` method. Replace the method body with this implementation:

```typescript
    const senderId = ctx.from?.id;
    if (!senderId) return;
    const senderIdStr = String(senderId);

    // ALLOWED_SENDERS holds numeric IDs only — silently reject everyone else.
    if (!this.config.telegram.allowedSenders.includes(senderIdStr)) {
      console.log(`[telegram] rejected sender ${senderIdStr}`);
      return;
    }

    const message = ctx.message;
    const text = message && 'text' in message ? message.text : '';
    if (!text) return;

    const session = this.sessions.ensureSession(
      `telegram:${senderIdStr}`,
      'telegram',
      senderIdStr,
      this.config.gemini.defaultModel,
    );
    const history = this.sessions.history(session.key);

    const result = await this.runner.run({
      session,
      systemPrompt: this.contextEngine.bootstrap(),
      history,
      userText: text,
    });

    this.sessions.appendAll(session.key, result.newHistory.slice(history.length));

    // Telegram caps messages at ~4000 chars — chunk if needed.
    let reply = result.reply || '(no reply)';
    while (reply.length > 0) {
      await ctx.reply(reply.slice(0, MAX_MESSAGE_LENGTH));
      reply = reply.slice(MAX_MESSAGE_LENGTH);
    }
```

> ⚠️ **Watch out:** `ALLOWED_SENDERS` must contain **numeric IDs**, not `@username`. Telegram's API only sends numeric IDs to bots. Setting `ALLOWED_SENDERS=dahabdev` looks right but silently rejects every message. Use `/start` on Telegram to discover your numeric ID.

### Open `src/server/http.ts` and fill the HTTP server

In your **editor**, open `src/server/http.ts`. You will see the `createHttpServer()` function with a `//REPLACE-SERVER-HTTP` marker. Replace the function body with this implementation:

```typescript
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/chat', async (req, res) => {
    const { sessionKey, message, channel, senderId } = req.body as {
      sessionKey?: string;
      message?: string;
      channel?: string;
      senderId?: string;
    };
    if (!sessionKey || !message) {
      res.status(400).json({ error: 'sessionKey and message are required' });
      return;
    }

    try {
      const session = sessions.ensureSession(
        sessionKey,
        channel ?? 'cli',
        senderId ?? 'cli',
        config.gemini.defaultModel,
      );
      const history = sessions.history(session.key);
      const result = await runner.run({
        session,
        systemPrompt: contextEngine.bootstrap(),
        history,
        userText: message,
      });
      sessions.appendAll(session.key, result.newHistory.slice(history.length));
      res.json({ text: result.reply, toolCallCount: result.toolCalls });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
```

### Open `src/index.ts` and fill the main entry point

In your **editor**, open `src/index.ts`. You will see the main function with a `//REPLACE-MAIN-ENTRY` marker. Replace the function body with this implementation:

```typescript
  const config = loadConfig();
  const { errors, warnings } = validateConfig(config);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[config] ${e}`);
    throw new Error('Invalid configuration — see errors above.');
  }

  const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const registry = new ToolRegistry();
  registerCoreTools(registry);

  const sessions = new SessionStore(config.paths.database);
  const contextEngine = new ContextEngine(config.paths.workspace);
  const runner = new AgentRunner(client, registry, config);

  const app = createHttpServer(config, runner, contextEngine, sessions);
  app.listen(config.server.port, () => {
    console.log(`[http] listening on http://${config.server.host}:${config.server.port}`);
  });

  if (config.telegram.botToken) {
    const tg = new TelegramAdapter(config, runner, contextEngine, sessions);
    await tg.launch();
  }

  console.log(`🤖 ${config.agent.name} is online.`);
```

### Verify your progress

In the **terminal**, run:

```bash
npm run verify
```

The type-checker confirms all modules wire together. Tests still pass.

### Run it

In the **terminal**:

```bash
npm run dev
```

**Example output**:

```
[http] listening on http://localhost:3000
[telegram] bot online
Agent Dudu is online.
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

### ✅ Section recap

By the end of this section you will:
- Store conversation history in SQLite keyed by `<channel>:<senderId>`.
- Wire Telegram via telegraf and handle the `/start` self-discovery pattern.
- Run an HTTP API at `localhost:3000` that powers both Telegram and the terminal REPL.
- See your agent live on two channels: Telegram and the CLI.

**Key takeaway:** Sessions are keyed `<channel>:<senderId>` — same agent, multiple users, no conversation leakage. Both Telegram and CLI POST to `/api/chat` and share the same session store.

## 7. Agent observability basics

You now have a working agent. But how do you **see** what it decided? Observability — logging each tool call and its result — is how you debug agent behavior and tune tool descriptions.

### Why observability matters

When an agent calls the wrong tool or a tool fails silently, you need a trace. Observability is the foundation for:
- **Debugging:** "Why did the agent call `web_search` instead of `web_fetch`?"
- **Tuning:** "Are tool descriptions clear enough? Which tools does the agent prefer?"
- **Production metrics:** in Level 4 you'll add structured tracing and cost attribution per user.

### Log each tool call and result

Open `src/agent/runner.ts`. Inside the agent loop (where you already have `const result = await this.registry.invoke(...)`), add this logging just **before** the result is appended to history:

```typescript
// Immediately after: const result = await this.registry.invoke(call.name ?? '', call.args ?? {}, ctx);
const truncatedResult = typeof result === 'string' 
  ? result.slice(0, 200) 
  : JSON.stringify(result).slice(0, 200);
console.log(`[agent] 🔧 tool: ${call.name}, args: ${JSON.stringify(call.args).slice(0, 100)}, result: ${truncatedResult}`);
```

### How to read the trace

Run your agent on Telegram or the CLI and send a message that triggers a tool call. Look at your terminal output:

```
[agent] 🔧 tool: web_search, args: {"query":"latest nodejs release"}, result: (stub) search results...
[agent] 🔧 tool: filesystem, args: {"action":"read","path":"IDENTITY.md"}, result: # Your Agent...
[agent] 🔧 tool: web_fetch, args: {"url":"https://example.com"}, result: <!doctype html>...
```

Each line shows:
- **Tool name** — which tool was called
- **Args (truncated)** — what parameters the LLM passed
- **Result (first 200 chars)** — what the tool returned

**Red flags to watch for:**
- ❌ `tool: web_search, args: {"query":"<something that makes no sense>"}` — agent misunderstood the user or bad tool description
- ❌ `tool: filesystem, args: {"action":"write",...}` — agent is trying to modify files when it should only read
- ✅ `tool: web_fetch, args: {"url":"https://..."}` → `result: <!doctype html>...` — expected flow

### Next: metrics and production tracing

This is where Level 4's `HealingEngine` picks up — structured logging, token tracking, and cost attribution per session. For now, `console.log` is your friend.

> ℹ️ **Note:** Production agents add a `Logger` service that writes to `stdout` or a file in JSON format, then ships to a metrics backend. The pattern you just added (tool name + args + result) is the foundation.

### ✅ Section recap

By the end of this section you will:
- Add a one-line `console.log` around each tool call to see the agent's decisions.
- Understand how to read the trace to debug tool selection and tune descriptions.
- Know that structured observability is the foundation for production metrics.

**Key takeaway:** Observability is how you debug agents. One log line per tool call (name, args, truncated result) shows you exactly what the agent decided — and whether it was right.

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

### What you built

By the end of this codelab (Chapters 1–7), you have:
- An `AgentRunner` wrapping Gemini in a 15-round tool-calling loop
- Three core tools: `web_search` (stub), `web_fetch`, `filesystem`
- A personality system: `IDENTITY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, `MEMORY.md`
- SQLite session storage keyed by `<channel>:<senderId>`
- Telegram integration with `/start` self-discovery
- An HTTP API (`localhost:3000`) powering the CLI REPL
- Observable tool calls via `console.log` traces
- Clean `npm run verify` and `npm run build` gates

### What is next

- **[Level 3 — Memory & Skills](https://github.com/dahabit/adkclaw/tree/main/level_3)** — your agent forgets you the moment a session expires. Time to give it a real memory.
- The full reference implementation: [github.com/dahabit/adkclaw](https://github.com/dahabit/adkclaw)
- Live cohort fleet: [adkclaw.dev](https://adkclaw.dev) — your beacon should now be lit (Level 2 badge unlocked).

### Resources

- [Google ADK documentation](https://google.github.io/adk-docs/)
- [Gemini API function calling guide](https://ai.google.dev/gemini-api/docs/function-calling)
- [Gemini API grounding guide](https://ai.google.dev/gemini-api/docs/grounding)
- [The AdkClaw repository](https://github.com/dahabit/adkclaw)
- [Other ADK codelabs](https://codelabs.developers.google.com/?text=adk)
- [Building AI Agents with ADK: The Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) — Google's official starter (Python; same patterns)

## Glossary

| Term | Definition |
|------|-----------|
| **Agent** | An LLM in a loop that can call tools, observe results, and act on the world. |
| **Agent loop** | The `think → act → observe → respond` pattern: call LLM, run tool calls, append results, repeat until text. |
| **Function calling** | Gemini's ability to emit structured tool calls instead of text; the runtime executes them. |
| **Tool** | A callable function the agent can invoke: `web_search`, `web_fetch`, `filesystem`, etc. |
| **Tool description** | The LLM-facing text that explains what a tool does; critical for correct tool selection. |
| **Tool registry** | The runtime component that holds all tools and converts them to Gemini function declarations. |
| **Session** | A conversation thread keyed by `<channel>:<senderId>`; persists history in SQLite. |
| **Context engine** | The component that reads `workspace/*.md` files and assembles the system prompt. |
| **Workspace** | The `workspace/` directory containing personality files (`IDENTITY.md`, `SOUL.md`, etc.). |
| **Personality** | The agent's voice, tone, and rules; assembled from markdown files, not source code. |
| **Observability** | Logging tool calls, arguments, and results to debug agent behavior. |
| **Permission tier** | How you control tool access: `allow`, `ask`, `deny`. |
| **Telegram adapter** | The component that connects telegraf to the agent loop. |
| **HTTP API** | The `localhost:3000` server that powers both Telegram and the CLI REPL. |

---

*This codelab is provided under [Creative Commons 4.0](https://creativecommons.org/licenses/by/4.0/). The AdkClaw repository is licensed under [Apache 2.0](https://github.com/dahabit/adkclaw/blob/main/LICENSE).*

*Authored by Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community.*
