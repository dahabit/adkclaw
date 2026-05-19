# Level 1: Build the Brain

![Level 1: Build the Brain](img/agent-loop.png)

**Wrap a single `generateContent` call in the core ADK pattern — `think → act → observe → respond` — give it tools, a personality, and a Telegram channel. By the end of this level your agent has a name and a working chat surface.**

You've used `client.models.generateContent()`. That's not an agent — it's a function call. In this level you'll wrap that one call in **a loop**, give it **tools** (web search, URL fetching, filesystem), hand it a **personality** through markdown files, and put it on **Telegram** so you can talk to it from your phone. Your agent will know your name, remember your conversation across turns, and search the web when it needs to.

## 🎯 What You'll Learn

| Concept | Description |
|---------|-------------|
| **The agent loop** | The core ADK pattern: `for (round...) { call LLM → execute tools → append → repeat }` |
| **Function calling** | How Gemini selects tools by their `description` (the LLM's only signal) |
| **`AgentTool` shape** | `name`, `description`, `permission` (allow/ask/deny), JSON Schema, `execute()` |
| **Tool permission tiers** | `allow` / `ask` / `deny` — the human-in-the-loop pattern |
| **Personality engineering** | `IDENTITY.md` + `SOUL.md` + `agent.yaml` — markdown beats hardcoded prompts |
| **Telegram via telegraf** | Receive update → normalize → call agent → reply (chunked if > 4K chars) |
| **SQLite sessions** | `<channel>:<senderId>` keys, atomic message writes, embedded zero-config DB |
| **The `/start` ID-discovery pattern** | Self-service way for users to find their numeric Telegram ID |

## ✅ What You'll Build

By the end of this level, you will have:

- 🧠 An `AgentRunner` class that wraps the ADK Gemini API in a tool-calling loop (capped at 15 rounds)
- 🛠️ A `ToolRegistry` with three working tools: `web_search`, `web_fetch`, `filesystem`
- 📝 A SQLite-backed session store that persists every message
- 💬 A Telegram bot that talks to your agent from your phone
- ❤️ A workspace personality layer (`IDENTITY.md`, `SOUL.md`, `USER.md`) — your agent will embrace nicknames warmly
- 🌐 An HTTP API at `localhost:3000` (Cloud Shell port-forwarded) — used by the terminal REPL too
- ✅ A passing `npm test` (50+ tests across the runner, registry, sessions, context engine)

## 📋 Prerequisites

- ✅ **Level 0 completed** — Cloud Shell ready, APIs enabled, `set_env.sh` generated
- ✅ Free [Gemini API key](https://aistudio.google.com/apikey) saved in `set_env.sh`
- ✅ [Telegram bot token](https://t.me/BotFather) (`/newbot`)
- ✅ Node.js 22+ in Cloud Shell (`nvm use 22`)

## 🚀 Quick Start

### 1. Set Up Environment

```bash
cd ~/adkclaw/level_1/starter
source ~/adkclaw/set_env.sh

# Install Node dependencies
npm install

# Verify the toolchain (offline checkpoint: tsc + vitest)
npm run verify
```

**Expected**: All tests pass (type-check + unit tests run without Gemini key).

### 2. Configure Your Agent

```bash
# Interactive wizard: name your agent, pick tone, paste your keys
npm run setup
```

Follow the prompts. Pick a name (`AdkClaw`, `Dudu`, `Coco` — anything you like) and a tone (try `friendly`).

The wizard writes `.env`, `agent.yaml`, and a populated `workspace/`.

### 3. Implement the Agent Loop (fill the markers)

Open `src/agent/runner.ts` and find the `// REPLACE-*` markers. Each section is pre-scaffolded with a throwing stub. Replace it with the actual code:

| Marker | Section | What to write |
|--------|---------|---------------|
| `// REPLACE: callGemini` | Line ~42 | The single call to `client.models.generateContent({...})` |
| `// REPLACE: runTurn loop` | Line ~X | The `for (let round...)` body that extracts tool calls, executes via registry, appends results |
| `// REPLACE: function call extraction` | Line ~Y | Read `response.functionCalls` and convert to executable form |
| `// REPLACE: history append` | Line ~Z | Push `{role: 'function', parts: [{functionResponse: ...}]}` after tool execution |

The starter type-checks before any marker is filled — run `npm run verify` after each section to validate your implementation.

The runner uses **dependency injection** — `ContextEngine`, `ToolRegistry`, `SessionStore` are passed in. Don't import them directly.

### 4. Implement the Three Tools (fill the markers)

| File | Marker | Tool | What to implement |
|------|--------|------|-------------------|
| `src/tools/web.ts` | `// REPLACE: web_search` | `web_search` | Use Gemini's built-in `googleSearchRetrieval` for grounded search |
| `src/tools/web.ts` | `// REPLACE: web_fetch` | `web_fetch` | `fetch(url)` then strip HTML to plain markdown |
| `src/tools/filesystem.ts` | `// REPLACE: filesystem` | `filesystem` | `read` / `write` / `list` inside `workspace/` with path-traversal blocking |

**Tip:** the tool's `description` field is the LLM's only signal for tool selection. Spend time on it. *"Run commands"* is bad. *"Execute shell commands inside the workspace directory. Returns stdout, stderr, and exit code."* is good.

### 5. Wire Telegram (fill the markers)

Open `src/channels/telegram.ts` and complete the `TelegramAdapter`:

| Marker | Method | What to implement |
|--------|--------|-------------------|
| `// REPLACE: bot.start handler` | `bot.start()` handler | Reply with the user's numeric ID (the `/start` discovery pattern) |
| `// REPLACE: handleMessage` | `handleMessage()` | Allowlist check → normalize → call `runner.run()` → reply chunked |

### 6. Verify Your Implementation (offline checkpoint)

```bash
npm run verify
```

This runs `tsc --noEmit` (type-check) + `vitest run` (unit tests). No Gemini key needed. All tests should pass before you move to step 7.

### 7. Run Your Agent

```bash
npm run dev
```

You'll see:
```
🤖 AdkClaw starting...
   Agent: Dudu (tone: friendly)
   Model: gemini-3.1-pro-preview (fallback: gemini-3-flash-preview)
   HTTP: http://localhost:3000
   Telegram: bot is online
🤖 AdkClaw is online.
```

### 8. Test on Telegram

1. Open Telegram, find your bot, send `/start`. It replies with your numeric ID.
2. Edit `.env`: set `ALLOWED_SENDERS=<your-numeric-id>` (no `@username`).
3. Restart: `Ctrl+C`, then `npm run dev`.
4. Send: *"Hi, I'm Ahmed. Can I name you Dudu?"*
   The agent replies: *"Dudu! I love it. Dudu it is. ❤️ What's our first task together?"*
5. Send: *"What's the latest stable Flutter version?"*
   It calls `web_search` and returns the version with a citation URL.

### 9. Test the REPL too

In a second Cloud Shell tab:
```bash
cd ~/adkclaw/level_1/starter
source ~/adkclaw/set_env.sh
npm run chat
```

Same agent, terminal interface. Same memory. Same personality.

### Stuck? Compare against the answer key

The complete Level 1 implementation is in `solutions/level_1/`:

```bash
diff ~/adkclaw/level_1/starter/src/agent/runner.ts ~/adkclaw/solutions/level_1/src/agent/runner.ts
```

This shows exactly where your implementation diverges from the expected solution.

## 🏆 Light Up Your Level 1 Badge

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox) (see [Level 0 → Connect to the Cohort Fleet](../level_0/README.md#-optional-connect-to-the-cohort-fleet)), your agent reports completion automatically.

**Trigger**: first Telegram message exchanged with your agent. After the agent replies, it calls the `mark_level_complete` tool, which POSTs an HMAC-signed badge to `api.adkclaw.dev`. Within ~2 seconds your beacon turns blue on the cohort fleet at [adkclaw.dev](https://adkclaw.dev).

If `ADKCLAW_BUILDER_SECRET` is unset the agent runs the same — it just won't appear on the fleet view.

## 📖 Full Codelab

For detailed step-by-step instructions with explanations:

**[📚 Level 1 Codelab →](https://codelabs.developers.google.com/adkclaw-level-1/instructions)**

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Level 1 Agent                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Telegram (telegraf) ──┐                                       │
│                          │     ┌──────────────────────────┐    │
│   CLI REPL (HTTP) ───────┼────▶│  AgentRunner             │    │
│                          │     │                           │    │
│   HTTP /api/chat ────────┘     │  for (round...) {         │    │
│                                │    response = generateContent │
│                                │    if (toolCalls.length)  │    │
│                                │      registry.execute()   │ ──▶ Gemini API
│                                │    else return text       │    │
│                                │  }                         │    │
│                                └──────────┬───────────────┘    │
│                                           │                      │
│                  ┌────────────────────────┼─────────────────┐   │
│                  ▼                        ▼                 ▼   │
│         ┌────────────────┐      ┌────────────────┐  ┌────────┐ │
│         │ ContextEngine  │      │ ToolRegistry   │  │SessionStore│
│         │ system prompt  │      │ web_search,    │  │ SQLite   │ │
│         │ from workspace │      │ web_fetch,     │  │ messages │ │
│         │ files          │      │ filesystem     │  │          │ │
│         └────────────────┘      └────────────────┘  └────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔑 Key Patterns

### The Agent Loop

```typescript
// src/agent/runner.ts (the core)
for (let round = 0; round < this.config.agent.maxToolRounds; round++) {
  const response = await this.callGemini(model, history, systemPrompt, sdkTools);

  const calls = extractFunctionCalls(response);
  if (calls.length === 0) {
    // LLM produced text → loop ends
    return response.text;
  }

  for (const call of calls) {
    const result = await registry.execute(call.name, call.args, ctx);
    history.push(toolResponsePart(call.name, result));
  }
  // Loop continues with new tool responses in history
}
```

### Tool registration

```typescript
// src/tools/web.ts (simplified)
export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    'Search Google for current, factual information. Use for news, ' +
    'recent events, version numbers, or anything time-sensitive. Returns ' +
    'cited results with URLs.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  async execute({ query }) {
    // Use Gemini's googleSearchRetrieval grounding
    return { results: [...] };
  },
};
```

### Personality through markdown

```markdown
<!-- workspace/IDENTITY.md -->
You are **{{AGENT_NAME}}** — but that's just your codename.
If {{USER_NAME}} gives you a nickname like Dudu or Buddy,
embrace it warmly. Your real name is whatever they call you.
```

The `ContextEngine.bootstrap()` reads this on every turn (cached by mtime — edit lands on next turn, no daemon restart).

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `Error: GEMINI_API_KEY is required` | Re-run `./scripts/setup.sh` from project root or edit `.env` directly |
| `[telegram] Rejected message from sender 5025183377` | Your `ALLOWED_SENDERS` is wrong. Set it to the numeric ID, not `@username`. Restart daemon. |
| `Telegram` `EFATAL` on launch | Bot token invalid. Re-create via [@BotFather](https://t.me/BotFather) |
| Cloud Shell port 3000 unreachable from browser | Click "Web Preview" (top-right) → "Preview on port 3000" |
| `npm test` fails on `runner.test.ts` | The agent loop hasn't been implemented. Check `// REPLACE` markers in `src/agent/runner.ts`. |
| `ERR_MODULE_NOT_FOUND` | Forgot `.js` extension on imports. NodeNext requires it. |

## 📁 Files Overview

| File | Purpose | What you implement |
|------|---------|-------------------|
| `src/types/index.ts` | Shared interfaces | (nothing — pre-built) |
| `src/config/index.ts` | Env + agent.yaml loader | (nothing — pre-built) |
| `src/cli/setup.ts` | Interactive wizard | (nothing — pre-built) |
| `src/agent/runner.ts` | **The agent loop** | `callGemini()`, `run()` body, function-call extraction |
| `src/tools/registry.ts` | Tool dispatcher | `register()`, `execute()`, `toFunctionDeclarations()` |
| `src/tools/web.ts` | `web_search`, `web_fetch` | both `execute()` bodies |
| `src/tools/filesystem.ts` | `filesystem` tool | `execute()` body with path-traversal block |
| `src/sessions/store.ts` | SQLite persistence | (provided — read it carefully) |
| `src/context/manager.ts` | System prompt assembly | `bootstrap()` — read workspace files in order |
| `src/channels/telegram.ts` | Telegraf adapter | `bot.start()` handler, `handleMessage()` |
| `src/server/http.ts` | Express server | `POST /api/chat` route |
| `src/index.ts` | Wire-up | The `main()` that constructs everything |

## 🏁 Ready for Level 2?

Before you continue, verify:

- [ ] Agent replies on Telegram (test: `/start`, then a real message)
- [ ] Agent uses your name in the reply (proves personality + memory work end-to-end)
- [ ] At least one tool call worked end-to-end (`web_search` or `filesystem`)
- [ ] You can restart the daemon and the agent remembers your name
- [ ] You can explain *why* `MAX_TOOL_ROUNDS` exists in your own words
- [ ] `npm test` passes

If any are red, drop in `#adkclaw-support` before moving on. L2 builds on a solid L1; skipping ahead with a broken loop is painful.

## ➡️ Next Level

Your agent works — but it forgets you the moment your conversation gets long. Time to give it a real memory.

**[Level 2: Memory & Skills →](../level_2/README.md)**

Learn how to build a 3-tier memory model (history → daily notes → bank), compact at 80% to survive 1M-token context windows, and let your agent learn new skills from markdown files at runtime.

---

*Your agent has a name now, explorer. The journey begins.* 🤖
