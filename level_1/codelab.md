author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert, MENA Dev community)
summary: Tour the AdkClaw repo, learn the six pillars of an autonomous agent, set up your environment, and prepare to build an agent on Telegram in Level 1.
id: adkclaw-codelab-1-architecture-tour
categories: ai,ml,gemini,adk,typescript,nodejs,agents
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 1 — Architecture Tour: What is an Autonomous Agent?

## Before you begin

In this codelab, you'll learn what an autonomous agent is, tour the AdkClaw scaffold you'll grow over the next four levels, and verify your environment is ready to build. This is **Level 1 of 5** in the AdkClaw series — the foundation tour. There is no code to write here; foundational concepts now prevent confusion later in Levels 2–4.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites Checklist

Before you start, make sure you have:

- ✓ Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) (at a "read and understand type signatures" level)
- ✓ A free Google account to obtain a [Gemini API key](https://aistudio.google.com/apikey)
- ✓ Access to [Telegram](https://telegram.org/) — free; you'll need a phone number
- ✓ **Node.js 22+** installed locally (verify with `node --version`)
- ✓ A working terminal and editor (VS Code, JetBrains, vim — anything you're comfortable with)
- ✓ [Git](https://git-scm.com/) installed
- ✓ A `.env` file (you'll create this with the setup wizard in Section 6)
- ✓ (Optional, for full-cloud path) A Google Cloud project (can wait until Level 4)

### What you'll learn

By the end of this codelab, you will:

- Understand the five-rung evolution from chatbot to autonomous agent — and identify which rung "agent" means in this course
- Recognize the six pillars every autonomous agent needs: **brain · tools · memory · personality · self-healing · sub-agents**
- Map each pillar to its folder in the AdkClaw codebase
- Distinguish between Google services (the brain, the cloud) and open-source plumbing (Express, SQLite, telegraf)
- Run the setup wizard and confirm your environment with `npx adkclaw check`

### What you'll have at the end

- A cloned AdkClaw starter scaffold on your machine
- A populated `.env` file with your Gemini API key and Telegram bot token
- A named agent (`agent.yaml`) with your chosen personality
- A `workspace/` directory containing your agent's identity files
- A passing `npx adkclaw check` — your green light for Level 2
- A clear mental model of how the six pillars map to folders

**Tip:** If you've never used Cloud Shell, the [Cloud Shell quickstart](https://cloud.google.com/shell/docs/launching-cloud-shell) walks you through Google Cloud fundamentals.

## Introduction

Most "agent tutorials" show you a chatbot wrapped in a fancy name. AdkClaw teaches something different: an **autonomous agent** that has a brain, hands, memory, a personality, the ability to recover from any failure, and a team of specialist sub-agents — built on top of Google's [Agent Development Kit (ADK)](https://google.github.io/adk-docs/) and [Gemini 3](https://deepmind.google/technologies/gemini/), in TypeScript you'll understand line-by-line.

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

> ℹ️ **Note:** Many frameworks and tutorials use "agent" loosely to mean Rung 2–4. This codelab is precise: we build Rung 5 only.

### ✅ Section recap

By the end of this section you will:
- Know where your agent sits on the five-rung ladder
- Understand why Rung 5 (autonomous) is different from Rungs 1–4
- Be ready to meet the six pillars that make Rung 5 possible

## 2. The six pillars

Every autonomous agent has these six things. Take any one away and it stops being autonomous.

```
   BRAIN  +  TOOLS  +  MEMORY  +  PERSONALITY  +  SELF-HEALING  +  SUB-AGENTS
```

### Brain

The LLM that thinks. AdkClaw uses **Gemini 3.1 Pro** for the parent agent (1 M token context, deep reasoning) and **Gemini 3 Flash** for sub-agents (cheaper, fast enough for specialist tasks). Reached via [`@google/genai`](https://www.npmjs.com/package/@google/genai), the official ADK SDK.

The brain lives in `src/agent/runner.ts` — a single file. Everything else in the repo wraps the one `client.models.generateContent({...})` call inside it.

> 🎯 **Goal:** In Level 1 you'll write that `runner.ts` file — 30 lines of agent loop.

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

> ❌ **Common pitfall:** Writing vague tool descriptions (e.g., "Searches the web") instead of specific ones. The LLM *only* sees the description when choosing tools. Invest in clarity here — it's the difference between your agent using the right tool and the wrong one.

### Memory

Three tiers, ranked by lifetime:

1. **In-context history** — the current conversation, lasts until compaction
2. **Daily notes** — raw events, append-only, rotated nightly into the bank
3. **Memory bank** — durable structured memory: `bank/facts/`, `bank/decisions/`, `bank/projects/`, `bank/people/`

Memory lives in `src/context/`, `src/memory/`, and the agent's `workspace/` directory.

> ℹ️ **Note:** The `workspace/` directory **is data, not code.** You debug your agent's mind with `cat`, `grep`, and `git diff` — Unix tools, not a custom UI. This keeps the agent's thinking transparent and auditable.

### Personality

Three files give the agent its public-facing identity:

- `workspace/IDENTITY.md` — who the agent is (name, role, backstory)
- `workspace/SOUL.md` — how it talks (tone, quirks, what it loves)
- `agent.yaml` — machine-readable identity (`name`, `tone`, `traits`)

Filled by the interactive setup wizard you'll run in Section 6. Naming the agent is part of the ceremony — students who name their agent something playful (Dudu, Buddy, Coco) report higher engagement and faster iteration than students who keep the default `AdkClaw`.

### Self-healing

The brand promise: **the agent never crashes.**

The recovery pyramid (built in Level 4):

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

Each sub-agent runs in an **isolated session** with **forked context** — it sees only the parent's IDENTITY and the relevant memory, never the full parent history. Isolation is a teaching point in Level 4.

Sub-agents live in `src/multi-agent/`.

### ✅ Section recap

By the end of this section you will:
- Understand what each pillar does and why all six are necessary for autonomy
- Know which pillar maps to which folder in the codebase
- Recognize that a chatbot has only the brain; an autonomous agent has all six pillars

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
| LLM (the brain) | **Gemini 3.1 Pro / 3 Flash** via `@google/genai` |
| Web grounding | Built into Gemini |
| Embeddings + vector search (Level 2 stretch, Level 4) | **Vertex AI** |
| Cloud hosting (Level 5) | **Cloud Run** |
| Persistent storage (Level 5) | **Firestore** + **Cloud Storage** |
| Secrets (Level 5) | **Secret Manager** |
| Scheduled work (Level 5) | **Cloud Scheduler** |
| CI/CD (Level 5) | **Cloud Build** |

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
- **No Postgres / Redis / Kafka.** A single-host agent doesn't need them. Cloud Firestore in Level 5 is the only managed datastore.
- **No third-party monitoring.** Cloud Logging plus a small dashboard suffice.

### ✅ Section recap

By the end of this section you will:
- Know which layers use Google services (Gemini, Vertex AI, Cloud Run)
- Know which layers use open-source libraries and why
- Understand why we're not using LangChain, MCP, or managed databases in Levels 1–3

## 4. Tour the starter scaffold

Time to look at what you'll clone in Level 1.

### Clone the repo

In the **terminal**, run:

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/level_2/starter
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
| `multi-agent/` | Level 4 | orchestrator + 4 specialist profiles |
| `healing/` | Level 4 | classifier + recovery engine |
| `cron/` | Level 4 | engine + heartbeat |

Level 5 doesn't add a top-level folder — it swaps adapters (`sessions/firestore-store.ts`, `storage/gcs.ts`) and adds a `Dockerfile` plus deploy scripts.

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
└── HEARTBEAT.md          open tasks (Level 4)
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

### ✅ Section recap

By the end of this section you will:
- Be able to find any pillar (brain, tools, memory, personality, self-healing, sub-agents) in the directory tree
- Understand which folders are scaffolded and which you'll create
- Know where your agent's identity files live (`workspace/IDENTITY.md`, `workspace/SOUL.md`)

## 5. The four-level journey

Preview of what each level adds and what you'll have at the end.

| Level | Title | What's added | At the end you have… |
|-------|-------|--------------|---------------------|
| **1** | [Build the Brain](https://github.com/dahabit/adkclaw/tree/main/level_2) | Brain + Tools + Personality | Agent on Telegram + CLI with conversation memory |
| **2** | [Memory & Skills](https://github.com/dahabit/adkclaw/tree/main/level_3) | Memory bank + compaction + skills | Agent that remembers across reboots, learns new skills at runtime |
| **3** | [The Agent Army](https://github.com/dahabit/adkclaw/tree/main/level_4) | Sub-agents + healing + cron | Multi-agent system, never crashes, runs autonomous schedules |
| **4** | [Ship to the Cloud](https://github.com/dahabit/adkclaw/tree/main/level_5) | Cloud Run + Storage + Secret Manager + webhook | Agent on Google Cloud, reachable from any phone, globally |

Each level is a self-contained working tree. After Level 1 you can clone `codelab/snapshot-1/` and skip ahead. After Level 5 your agent runs 24/7 on Google Cloud.

### ✅ Section recap

By the end of this section you will:
- Know what each of the next four levels teaches
- Understand that you can stop at any level and have a working agent
- Be able to point to a reference implementation for each level

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

> ⚠️ **Watch out:** Node 20 or earlier will fail. Some npm packages require Node 22+ features. Verify your version before proceeding.

### Install dependencies

In the **starter directory**, run:

```bash
npm install
```

This downloads the dependencies listed in `package.json`. Most of the size is Playwright's browser binaries. If you don't plan to use browser automation tools in Level 1, you can skip the download:

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

You can add Playwright binaries later without reinstalling.

### Run the setup wizard

The wizard names your agent, generates `.env`, and populates your workspace identity files.

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
| Telegram allowed sender IDs | leave blank for now (you'll fill it in Level 2 after `/start`) |

The wizard writes:
- `.env` — populated with your keys
- `agent.yaml` — populated with your chosen name and tone
- `workspace/` — copied from `workspace.example/`, with your agent's name substituted

> ℹ️ **Note:** You can re-run `npm run setup` anytime to change your agent's name or tone. Your `.env` keys are preserved by default.

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
⚠ ALLOWED_SENDERS empty (expected — you'll fill this in Level 2)
✓ All checks passed (with 1 warning)
```

The `ALLOWED_SENDERS` warning is expected — you'll populate it in Level 2 after Telegram tells you your numeric user ID.

> ❌ **Common pitfall:** If you see `✗ GEMINI_API_KEY not found`, your key wasn't pasted correctly. Re-run `npm run setup` and paste the key again.

### Run the scaffold

```bash
npm run dev
```

**Example output**:

```
🤖 AdkClaw scaffold v0 — start Level 1 to build the brain
```

The scaffold is intentionally a one-line stub. Level 1 (the next codelab) replaces it with the agent runner loop.

> 🎯 **Goal:** At the end of this section, `npx adkclaw check` should show all green ticks (except `ALLOWED_SENDERS` warning).

### ✅ Section recap

By the end of this section you will:
- Have Node 22+ running on your machine
- Have a cloned `level_2/starter` directory with dependencies installed
- Have a populated `.env` file with your Gemini API key and Telegram bot token
- Have a named agent with its own `workspace/` directory
- Have a passing `npx adkclaw check` (green light for Level 1)

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
cd adkclaw/level_2/starter
npm install
npm run setup
npx adkclaw check
```

Same steps as self-study; the only difference is the host machine.

**Tip:** Cloud Shell sessions time out after 20 minutes of inactivity. For long-running daemons in Level 1+, run `npm run dev` and keep the tab focused, or use `nohup npm run dev &` to detach.

### ✅ Section recap

By the end of this section you will (if taking the Cloud Shell path):
- Know how to open and navigate Cloud Shell
- Understand that Cloud Shell has persistent storage for your project
- Be able to run the same setup steps as self-study, on Google's infrastructure

---

## Congratulations!

You've toured the architecture, named your agent, and verified your environment. You have a clear mental model: an autonomous agent is **brain + tools + memory + personality + self-healing + sub-agents**, and every pillar has a folder you can point to.

## What you built

In this codelab you:

- Placed "agent" on the five-rung evolution ladder — Rung 5, the strictest definition
- Met the six pillars (**brain · tools · memory · personality · self-healing · sub-agents**) and where each lives in the codebase
- Understood why Google services power the brain and cloud, while open-source libraries handle the plumbing
- Toured the starter scaffold and identified the 11 folders you'll create across Levels 2–4
- Cloned the repo, ran the setup wizard, and confirmed `npx adkclaw check` passes
- Named your agent (the first ceremony of autonomous agent building)

## Optional: Deepen your understanding

Before moving to Level 2, try these:

- **Edit your identity:** Open `workspace/IDENTITY.md` in your editor and rewrite it in your voice. This is what your agent will read on every turn — make it personal.
- **Explore the tool interface:** Look at `src/types/index.ts` and skim the `AgentTool` interface. You'll implement your first three tools to match this shape in Level 2.
- **Map the code:** Create a sketch or mind map of the six pillars and their folders. Reference it as you build in Levels 2–4.

## What's next

This was **Level 1 — Architecture Tour**. You've learned the territory. Now:

- **[Level 2 — Build the Brain](https://github.com/dahabit/adkclaw/tree/main/level_2)** — Write the 30-line agent loop, register three tools, handle Telegram messages, store conversation history.
- **Level 3 — Memory & Skills** (coming next in the series)
- **Level 4 — The Agent Army** — Sub-agents, self-healing, cron scheduling
- **Level 5 — Ship to the Cloud** — Deploy to Google Cloud Run

The full reference implementation: [github.com/dahabit/adkclaw](https://github.com/dahabit/adkclaw)

Live cohort fleet: [adkclaw.dev](https://adkclaw.dev) — see who else is building right now.

## Glossary

**Autonomous Agent** — Rung 5 on the evolution ladder. An AI system with all six pillars: a brain (LLM), tools (hands to act), memory (across sessions), personality (identity), self-healing (never crashes), and sub-agents (delegation).

**Brain** — The LLM (Gemini 3.1 Pro or 3 Flash). The thinking engine. Lives in `src/agent/runner.ts`.

**Tool** — A function the agent can call to act on the world (read a file, search the web, schedule a task). Lives in `src/tools/`.

**Memory** — Three tiers: in-context history (current conversation), daily notes (raw events), and the memory bank (structured long-term facts, decisions, projects, people). Lives in `src/memory/`, `src/context/`, and `workspace/`.

**Personality** — Three files: `IDENTITY.md` (who you are), `SOUL.md` (how you talk), `agent.yaml` (machine-readable config).

**Self-healing** — The recovery pyramid: classify → retry → fallback → recover → degrade → escalate. The agent's promise to never crash.

**Sub-agent** — A specialist AI that runs in isolation, tasked with a specific job (research, coding, communication). Lives in `src/multi-agent/`.

**Workspace** — The `workspace/` directory. Your agent's brain on disk. Markdown files, no database. Debug with `cat`, `grep`, `git diff`.

**Pillar** — One of the six foundational components of an autonomous agent. All six are required; none are optional.

**Rung** — One of five levels on the evolution ladder from chatbot (Rung 1) to autonomous agent (Rung 5). AdkClaw teaches Rung 5.

**Level** — One of five codelabs in the AdkClaw series. This is Level 1 (Architecture Tour). Level 2 is Build the Brain. Levels 3–5 follow.

**Setup Wizard** — Interactive CLI (`npm run setup`) that names your agent, generates `.env`, and populates `workspace/`. Run it once to get started, or anytime to change your agent's identity.

**Adkclaw Check** — Verification script (`npx adkclaw check`) that confirms your environment is ready. Green ticks = you can start Level 2.

---

## Resources

- [Google ADK documentation](https://google.github.io/adk-docs/)
- [Gemini API reference](https://ai.google.dev/)
- [The AdkClaw repository](https://github.com/dahabit/adkclaw)
- [Other ADK codelabs](https://codelabs.developers.google.com/?text=adk)
- [Building AI Agents with ADK: The Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) — Google's official starter
- [Build Multi-Agent Systems with ADK](https://codelabs.developers.google.com/codelabs/production-ready-ai-with-gc/3-developing-agents/build-a-multi-agent-system-with-adk) — when you finish Level 4 and want more

---

*This codelab is provided under [Creative Commons 4.0](https://creativecommons.org/licenses/by/4.0/). The AdkClaw repository is licensed under [Apache 2.0](https://github.com/dahabit/adkclaw/blob/main/LICENSE).*

*Authored by Ahmed Abu Eldahab — Google Developer Expert, MENA Dev community.*
