author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert, MENA Dev community)
summary: Tour the AdkClaw repo, learn the six pillars of an autonomous agent, set up your environment, and prepare to build an agent on Telegram in Level 1.
id: adkclaw-codelab-0-architecture-tour
categories: ai,ml,gemini,adk,typescript,nodejs,agents
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 0 — Architecture Tour: What is an Autonomous Agent?

## Before you begin

In this codelab, you'll learn what an autonomous agent is, tour the AdkClaw scaffold you'll grow over the next four levels, and verify your environment is ready to build. This is **Level 0 of 5** in the AdkClaw series — the foundation tour. There is no code to write here; every minute spent now saves an hour of head-scratching once you start building in Level 1.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites

- Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- Familiarity with the [Gemini API](https://ai.google.dev/) at a "I've called `generateContent` once" level
- A working terminal and editor (VS Code, JetBrains, vim — anything you're comfortable with)

### What you'll learn

- The five-rung evolution from chatbot to autonomous agent — and which rung "agent" actually means
- The six pillars every autonomous agent has: **brain · tools · memory · personality · self-healing · sub-agents**
- How the AdkClaw repo maps each pillar to a folder, and which folders you'll create in Levels 1–4
- The difference between Google services we use (the brain, the cloud) and open-source plumbing (Express, SQLite, telegraf)
- How to run the AdkClaw setup wizard, generate your `agent.yaml`, and confirm your environment passes `npx adkclaw check`

### What you'll need

- A computer with **Node.js 22+** installed (verify with `node --version`)
- A free [Gemini API key](https://aistudio.google.com/apikey) — used in Level 1
- A [Telegram bot token](https://t.me/BotFather) (free; send `/newbot` to BotFather) — used in Level 1
- [Git](https://git-scm.com/) installed
- (Self-study only) ~1 GB free disk for `node_modules`
- (For Level 4) A Google Cloud project with billing enabled — you can defer this until Level 4

**Tip:** If you've never used Cloud Shell, the [optional Bootcamp](https://github.com/dahabit/adkclaw/tree/main/bootcamp) walks you through Google Cloud fundamentals before this codelab.

## Introduction

Most "agent tutorials" show you a chatbot wrapped in a fancy name. AdkClaw teaches something different: an **autonomous agent** that has a brain, hands, memory, a personality, the ability to recover from any failure, and a team of specialist sub-agents — built on top of Google's [Agent Development Kit (ADK)](https://google.github.io/adk-docs/) and [Gemini 2.5](https://deepmind.google/technologies/gemini/), in TypeScript you'll understand line-by-line.

This codelab maps the territory before you start the build. By the end of the next four levels you'll have an autonomous agent on Google Cloud, named whatever you want, reachable from any phone — and the mental model and reference code to build a different one tomorrow.

**Today there is no code to write.** Today we name the parts.

### What you'll build

By the end of this codelab, you will have:

- A working clone of the **starter scaffold** in your terminal
- A populated `.env` with your Gemini API key and Telegram bot token
- A populated `agent.yaml` and `workspace/` (your agent's identity files)
- A green `npx adkclaw check` confirming everything is wired correctly
- A clear mental map of where every folder lives in the autonomous-agent picture
- Confidence to start writing the agent loop in Level 1

## 1. The five-rung evolution — where "agent" actually starts

Different products mean different things by "AI agent". This series uses the strictest definition. Knowing where on the ladder each system lives saves you confusion when reading other tutorials.

| Rung | Capability | Examples |
|------|-----------|----------|
| 1. **Chatbot** | One prompt, one reply, no memory | Early ChatGPT |
| 2. **Stateful chat** | Remembers the current conversation | Anthropic Console, Claude.ai |
| 3. **RAG** | Retrieves over a corpus before answering | Perplexity, Glean |
| 4. **Tool-using** | Reads files, calls APIs, writes outputs | Cursor, Copilot Workspace |
| 5. **Autonomous** | Memory across sessions, recovers from failures, runs scheduled work, spawns sub-agents | What you build in Levels 1–4 |

A chatbot **answers**. An autonomous agent **acts** — across time, across channels, and across delegation to sub-agents. AdkClaw teaches Rung 5.

### Section recap

- The word "agent" gets used for everything from Rung 1 to Rung 5; AdkClaw means Rung 5 specifically.
- The next sections explain what makes Rung 5 different.
- Reference: [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md) covers the rung definitions in depth.

## 2. The six pillars

Every autonomous agent has these six things. Take any one away and it stops being autonomous.

```
   BRAIN  +  TOOLS  +  MEMORY  +  PERSONALITY  +  SELF-HEALING  +  SUB-AGENTS
```

### Brain

The LLM that thinks. AdkClaw uses **Gemini 2.5 Pro** for the parent agent (1 M token context, deep reasoning) and **Gemini 2.5 Flash** for sub-agents (10× cheaper, fast enough for specialist tasks). Reached via [`@google/genai`](https://www.npmjs.com/package/@google/genai), the official ADK SDK.

The brain lives in `src/agent/runner.ts` — a single file. Everything else in the repo wraps the one `client.models.generateContent({...})` call inside it.

### Tools

The hands that act on the world. Twenty-one tools by Level 4: filesystem read/write, web search, web fetch, browser automation, content extraction, memory operations, skill loading, sub-agent spawning, cron scheduling, and more.

Tools live in `src/tools/`. Each tool has the same shape:

```typescript
export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    'Search Google for current information. Use for news, recent events, ' +
    'version numbers, or anything time-sensitive. Returns cited results.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  async execute({ query }) {
    /* ... */
  },
};
```

**Important:** the tool's `description` field is the **only signal** the LLM has when picking which tool to call. Spend more time on it than you think you should. Bad descriptions are the #1 reason agents pick the wrong tool.

### Memory

Three tiers, ranked by lifetime:

1. **In-context history** — the current conversation, lasts until compaction
2. **Daily notes** — raw events, append-only, rotated nightly into the bank
3. **Memory bank** — durable structured memory: `bank/facts/`, `bank/decisions/`, `bank/projects/`, `bank/people/`

Memory lives in `src/context/`, `src/memory/`, and the agent's `workspace/` directory.

**Note:** the `workspace/` directory **is data, not code.** You debug your agent's mind with `cat`, `grep`, and `git diff` — Unix tools, not a custom UI.

### Personality

Three files give the agent its public-facing identity:

- `workspace/IDENTITY.md` — who the agent is (name, role, backstory)
- `workspace/SOUL.md` — how it talks (tone, quirks, what it loves)
- `agent.yaml` — machine-readable identity (`name`, `tone`, `traits`)

Filled by the interactive setup wizard you'll run later in this codelab. Naming the agent is part of the ceremony — students who name their agent something playful (Dudu, Buddy, Coco) report higher engagement than students who keep the default `AdkClaw`.

### Self-healing

The brand promise: **the agent never crashes.**

The recovery pyramid (built in Level 3):

```
                              ESCALATE  ↑ tell the user
                                DEGRADE ↑ reduced capability
                                  RECOVER ↑ restart subsystem
                                  FALLBACK ↑ Pro → Flash, Playwright → web_fetch
                                    RETRY ↑ exp backoff 1s / 2s / 4s
                                  CLASSIFY → which tier applies?
```

Lives in `src/healing/`. Every new component you build will answer: *what happens when this fails?*

### Sub-agents

Specialists collaborating with the main agent. Four profiles in Level 3:

- **SearchAgent** — web search + grounding
- **ResearcherAgent** — multi-step deep research
- **CommunicatorAgent** — talks to other agents (A2A protocol)
- **CoderAgent** — writes code (optional, integrates Gemini CLI)

Each sub-agent runs in an **isolated session** with **forked context** — it sees only the parent's IDENTITY and the relevant memory, never the full parent history. Isolation is a teaching point in Level 3.

Sub-agents live in `src/multi-agent/`.

### Section recap

- Six pillars: **brain · tools · memory · personality · self-healing · sub-agents**.
- A chatbot has only the brain. A RAG system has brain + retrieval. An autonomous agent has all six.
- Reference: each pillar maps to a specific folder under `src/` — see Chapter 4 for the full map.

## 3. The tech stack

A clear answer to "why this and not LangChain?".

### Why TypeScript?

- Tool schemas are typed contracts between the LLM and your code
- Async-first runtime — agents are I/O-bound, not CPU-bound
- Single language for backend + tools + CLI
- Familiar to most web developers

The tradeoff: Python has more LLM tooling. TypeScript has fewer dependencies you need to learn.

### Google services we use

| Layer | Google product |
|-------|----------------|
| LLM (the brain) | **Gemini 2.5 Pro / Flash** via `@google/genai` |
| Web grounding | Built into Gemini |
| Embeddings + vector search (Level 2 stretch, Level 4) | **Vertex AI** |
| Cloud hosting (Level 4) | **Cloud Run** |
| Persistent storage (Level 4) | **Firestore** + **Cloud Storage** |
| Secrets (Level 4) | **Secret Manager** |
| Scheduled work (Level 4) | **Cloud Scheduler** |
| CI/CD (Level 4) | **Cloud Build** |

### Open-source plumbing

| Need | Library |
|------|---------|
| HTTP server | [Express](https://expressjs.com/) |
| Telegram bot | [telegraf](https://telegraf.js.org/) |
| Local DB (Levels 1–3) | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Browser automation (optional) | [Playwright](https://playwright.dev/) |
| In-process cron (Levels 1–3) | [node-cron](https://github.com/node-cron/node-cron) |
| Markdown rendering | [marked](https://marked.js.org/) |

### What we deliberately do NOT use

- **No LangChain / LangGraph.** Frameworks hide the agent loop you need to see. The loop is 30 lines — you'll write them yourself in Level 1.
- **No Model Context Protocol (MCP).** MCP is for tool *discovery*; this course teaches tool *authoring*. You can add MCP later as an exercise.
- **No Postgres / Redis / Kafka.** A single-host agent doesn't need them. Cloud Firestore in Level 4 is the only managed datastore.
- **No third-party monitoring.** Cloud Logging plus a small dashboard suffice.

### Section recap

- The brain and cloud are Google. The plumbing is open source. Level 4 swaps the plumbing for Google Cloud equivalents.
- Reference: [`docs/tech-stack.md`](https://github.com/dahabit/adkclaw/blob/main/docs/tech-stack.md) has the full dependency audit with rationale per package.

## 4. Tour the starter scaffold

Time to look at what you'll clone in Level 1.

### Clone the repo

In the **terminal**, run:

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/codelab/starter
```

**Example output** (yours may be a little different):

```
Cloning into 'adkclaw'...
remote: Enumerating objects: 1245, done.
...
Resolving deltas: 100% (412/412), done.
```

### Top-level layout

```
starter/
├── package.json                deps + scripts + the `adkclaw` bin
├── tsconfig.json               strict, ESM, NodeNext
├── .env.example                fill in API keys here
├── agent.yaml.example          name, tone, traits — schema
├── workspace.example/          IDENTITY/SOUL/AGENTS/MEMORY templates
├── data/                       SQLite + logs (gitignored)
├── src/                        all the code (will grow over 4 levels)
├── docs/                       teaching guide + API reference
├── bin/adkclaw                 convenience wrapper for the CLI
└── README.md                   index
```

The four pre-filled folders are `src/types/`, `src/config/`, `src/cli/`, and `workspace.example/`. Everything else under `src/` you'll create as you go.

### `src/` — the four pre-filled subfolders

```
src/
├── types/         all shared interfaces (AgentTool, Session, Message, ToolResult, …)
├── config/        env + agent.yaml loader with validation
├── cli/           setup wizard, REPL stub, `adkclaw` CLI entrypoint
└── index.ts       the scaffold stub — replaced in Level 1
```

**Important:** these four are pre-filled because they're not where the lesson is. Boilerplate is solved; you focus on the agent code.

### `src/` — the eleven folders you'll create

| Folder | Created in | What it holds |
|--------|------------|---------------|
| `agent/` | Level 1 | `runner.ts` — the agent loop |
| `tools/` | Level 1 | tool registry + each tool's `execute()` |
| `sessions/` | Level 1 | SQLite store, `<channel>:<senderId>` keys |
| `channels/` | Level 1 | Telegram adapter via telegraf |
| `server/` | Level 1 | Express HTTP server, `/api/chat` endpoint |
| `context/` | Level 2 | bootstrap (read workspace files), compaction |
| `memory/` | Level 2 | bank, daily notes, consolidator |
| `skills/` | Level 2 | markdown-skill loader |
| `multi-agent/` | Level 3 | orchestrator + 4 specialist profiles |
| `healing/` | Level 3 | classifier + recovery engine |
| `cron/` | Level 3 | engine + heartbeat |

Level 4 doesn't add a top-level folder — it swaps adapters (`sessions/firestore-store.ts`, `storage/gcs.ts`) and adds a `Dockerfile` plus deploy scripts.

### `workspace/` — the agent's brain on disk

After running the setup wizard, you'll have a populated `workspace/` next to `workspace.example/`:

```
workspace/
├── IDENTITY.md           who you are (filled by setup)
├── SOUL.md               how you talk (filled by setup)
├── USER.md               about the human you talk to
├── AGENTS.md             behavioral rules
├── MEMORY.md             curated long-term memory (cap ~20K tokens)
├── memory/YYYY-MM-DD.md  raw daily notes
├── bank/                 structured memory
│   ├── facts/
│   ├── decisions/
│   ├── projects/
│   └── people/
├── skills/               markdown skills (runtime extensible — Level 2)
└── HEARTBEAT.md          open tasks (Level 3)
```

**Note:** every file under `workspace/` is plain Markdown. To debug your agent's mind, open them in your editor or `cat` them in the terminal. There is no proprietary database.

### Pillars → folders map

| Pillar | Where it lives |
|--------|----------------|
| Brain | `src/agent/runner.ts` |
| Tools | `src/tools/*` |
| Memory | `src/context/`, `src/memory/`, `workspace/` |
| Personality | `workspace/IDENTITY.md`, `SOUL.md`, `agent.yaml` |
| Self-healing | `src/healing/` |
| Sub-agents | `src/multi-agent/` |

### Section recap

- The starter scaffold has 4 pre-filled subfolders under `src/` and 11 you'll create across Levels 1–4.
- Every pillar maps to one or two specific folders — no magic, no hidden state.
- Reference: [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md) walks the same map at narrative pace.

## 5. The four-level journey

Preview of what each level adds and what you'll have at the end.

| Level | Title | What's added | At the end you have… |
|-------|-------|--------------|---------------------|
| **1** | [Build the Brain](https://github.com/dahabit/adkclaw/tree/main/level_1) | Brain + Tools + Personality | Agent on Telegram + CLI with conversation memory |
| **2** | [Memory & Skills](https://github.com/dahabit/adkclaw/tree/main/level_2) | Memory bank + compaction + skills | Agent that remembers across reboots, learns new skills at runtime |
| **3** | [The Agent Army](https://github.com/dahabit/adkclaw/tree/main/level_3) | Sub-agents + healing + cron | Multi-agent system, never crashes, runs autonomous schedules |
| **4** | [Ship to the Cloud](https://github.com/dahabit/adkclaw/tree/main/level_4) | Cloud Run + Storage + Secret Manager + webhook | Agent on Google Cloud, reachable from any phone, globally |

Each level is a self-contained working tree. After Level 1 you can clone `codelab/snapshot-1/` and skip ahead. After Level 4 your agent runs 24/7 on Google Cloud.

### Section recap

- Four levels, each adding two-or-three pillars (or, in Level 4, the operational layer for everything).
- You can pause after any level — the agent still works, just with fewer pillars active.
- Reference: each level has its own `README.md` with the same structure as this codelab.

## 6. Set up your environment

Time to get the scaffold running on your machine.

### Verify Node.js

In the **terminal**, run:

```bash
node --version
```

**Example output**:

```
v22.11.0
```

If you see anything below `v22.0.0`, install Node 22 from [nodejs.org](https://nodejs.org/) or via [`nvm`](https://github.com/nvm-sh/nvm):

```bash
nvm install 22
nvm use 22
```

### Install dependencies

In the **starter directory**, run:

```bash
npm install
```

The first run takes about 90 seconds and downloads ~600 MB of `node_modules`. (Most of it is Playwright; you can skip its browser binaries by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if you don't plan to use browser tools — they're optional in Level 1.)

### Run the setup wizard

The wizard names your agent, generates `.env`, and copies the workspace template.

In the **terminal**, run:

```bash
npm run setup
```

Follow the prompts. Suggested answers for your first run:

| Prompt | Answer |
|--------|--------|
| Agent name | `Dudu` (or anything you like) |
| Agent tone | `friendly` |
| Gemini API key | paste from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Telegram bot token | paste from [@BotFather](https://t.me/BotFather) — send `/newbot` first |
| Telegram allowed sender IDs | leave blank for now (filled in Level 1 after `/start`) |

The wizard writes:
- `.env` — populated with your keys
- `agent.yaml` — populated with your chosen name + tone
- `workspace/` — copied from `workspace.example/`, with your agent's name substituted

**Tip:** You can re-run `npm run setup` anytime to change your agent's name or tone. Your `.env` keys are preserved by default.

### Verify everything is wired

Run the pre-flight check:

```bash
npx adkclaw check
```

**Example output** (yours may be a little different):

```
✓ Node 22.11.0 detected
✓ GEMINI_API_KEY set (39 chars)
✓ TELEGRAM_BOT_TOKEN set (46 chars)
✓ agent.yaml: name=Dudu, tone=friendly
✓ workspace/IDENTITY.md exists (724 bytes)
✓ workspace/SOUL.md exists (612 bytes)
✓ data/ writable
⚠ ALLOWED_SENDERS empty (expected — Level 1 covers it)
✓ All checks passed (with 1 warning)
```

The `ALLOWED_SENDERS` warning is expected — you'll fill it in Level 1 after Telegram tells you your numeric ID.

### Run the scaffold

```bash
npm run dev
```

**Example output**:

```
🤖 AdkClaw scaffold v0 — start Level 1 to build the brain
```

The scaffold is intentionally a one-line stub. Level 1 replaces it with the agent runner.

### Section recap

- `npm run setup` is the ceremony — naming your agent, pasting your keys.
- `npx adkclaw check` is your pre-flight: green ticks mean Level 1 will work without setup pain.
- Reference: [`src/cli/setup.ts`](https://github.com/dahabit/adkclaw/blob/main/codelab/starter/src/cli/setup.ts) is the full wizard implementation.

## 7. (Optional) Cloud Shell setup

If you're in an in-person workshop with sponsored Cloud Shell access — or if you just don't want to install Node locally — Cloud Shell is a fully-supported alternative.

### Open Cloud Shell

Visit [console.cloud.google.com](https://console.cloud.google.com) and click the terminal icon (top-right). Cloud Shell opens with `gcloud`, `node`, `npm`, and a 5 GB persistent home directory.

### Install Node 22 (if Cloud Shell defaults to an older version)

```bash
nvm install 22 && nvm use 22 && nvm alias default 22
```

### Clone, install, set up

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/codelab/starter
npm install
npm run setup
npx adkclaw check
```

Same steps as self-study; the only difference is the host machine.

**Tip:** Cloud Shell sessions time out after 20 minutes of inactivity. For long-running daemons in Level 1+, run `npm run dev` and keep the tab focused, or use `nohup npm run dev &` to detach.

### Section recap

- Cloud Shell is the "no-install" path — same code, different host.
- Persistence: your home directory is preserved across sessions; `node_modules` survives reboots.
- Reference: see [Bootcamp](https://github.com/dahabit/adkclaw/tree/main/bootcamp) for a full Cloud Shell primer.

## Congratulations!

You've toured the architecture, named your agent, and verified your environment. You have a clear mental model: an autonomous agent is **brain + tools + memory + personality + self-healing + sub-agents**, and every pillar has a folder you can point to. Tomorrow you start the build.

### Recap

In this codelab you:

- Placed "agent" on the five-rung evolution ladder — Rung 5, the strictest definition
- Learned the six pillars and which folder each lives in
- Understood the Google + open-source split: brain and cloud are Google, plumbing is open source
- Toured the starter scaffold and the eleven folders you'll create across Levels 1–4
- Cloned the repo, ran the setup wizard, and confirmed `npx adkclaw check` passes
- Named your agent (the first ceremony of the journey)

### Continued experimentation

Try these before moving on to Level 1:

- Open `workspace/IDENTITY.md` in your editor and rewrite it in your voice. The agent reads this on every turn.
- Look at `src/types/index.ts` and skim the `AgentTool` interface — you'll implement three tools that match this shape in Level 1.
- Read [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md) for the deep "why" behind each pillar.

### What's next

- **[Level 1 — Build the Brain](https://github.com/dahabit/adkclaw/tree/main/level_1)** — wrap the Gemini API in an agent loop, register three tools, give your agent a personality, put it on Telegram.
- The full reference implementation: [github.com/dahabit/adkclaw](https://github.com/dahabit/adkclaw)
- Architecture deep-dive: [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md)
- Live cohort fleet: [adkclaw.dev](https://adkclaw.dev) — see who else is building right now.

### Resources

- [Google ADK documentation](https://google.github.io/adk-docs/)
- [Gemini API reference](https://ai.google.dev/)
- [The AdkClaw repository](https://github.com/dahabit/adkclaw)
- [Other ADK codelabs](https://codelabs.developers.google.com/?text=adk)
- [Building AI Agents with ADK: The Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) — Google's official starter
- [Build Multi-Agent Systems with ADK](https://codelabs.developers.google.com/codelabs/production-ready-ai-with-gc/3-developing-agents/build-a-multi-agent-system-with-adk) — when you finish Level 3 and want more

---

*This codelab is provided under [Creative Commons 4.0](https://creativecommons.org/licenses/by/4.0/). The AdkClaw repository is licensed under [Apache 2.0](https://github.com/dahabit/adkclaw/blob/main/LICENSE).*

*Authored by Ahmed Abu Eldahab — Google Developer Expert, MENA Dev community.*
