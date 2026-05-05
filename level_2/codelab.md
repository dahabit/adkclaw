author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community)
summary: Give your agent persistent memory that survives reboots, and the ability to learn new skills from markdown files at runtime. Build the context engine, the memory bank, daily notes, the consolidator, and the markdown-skills loader.
id: adkclaw-codelab-2-memory-and-skills
categories: ai,ml,gemini,adk,typescript,nodejs,agents,memory
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 2 — Memory & Skills

## Before you begin

In Level 1 your agent had a brain, three tools, a personality, and a Telegram channel — but it forgot you the moment a session expired. Today it learns to **remember forever** and **gain new skills at runtime, with no redeploy**. This is **Level 2 of 5** in the AdkClaw series.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites

- Completed [Level 1 — Build the Brain](https://github.com/dahabit/adkclaw/tree/main/level_1)
- A working agent on Telegram from L1 (you'll extend its repo, not start fresh)
- Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- A working terminal and editor

### What you will learn

- The **three-tier memory model**: in-context history → daily notes → memory bank
- The **context bootstrap pattern**: assemble the system prompt from `workspace/` files in a fixed order, with mtime-based caching
- **Compaction at 80%**: summarise the oldest turns when conversation history pushes against the model window, with strict preservation rules for IDs, URLs, and decisions
- The **memory bank taxonomy** (`facts` / `decisions` / `projects` / `people`) — why structured beats vector search at small scale
- **Daily notes** — append-only timestamped scratch pad, one file per day
- The **consolidator pattern** — promote daily notes into the bank with an LLM-curation step
- **Markdown skills** — drop a `.md` file in `workspace/skills/` and the agent gains a capability at the next bootstrap
- The **self-learning loop** — the agent watches its own session and drafts new skill files

### What you will need

- A computer with **Node.js 22+** installed (`node --version` ≥ v22.0.0)
- The Level 1 codebase (yours from yesterday or fresh from `codelab/starter/`)
- A free [Gemini API key](https://aistudio.google.com/apikey) (already in your `.env` from L1)
- A [Telegram bot token](https://t.me/BotFather) (already in your `.env` from L1)
- ~30 testing turns of Gemini Pro (~$0.50) and ~5 compaction calls (~$0.20) — total **~$1**

## Introduction

A conversation is a fragile thing. The window closes when memory fills up. The session ends when the daemon restarts. The day ends when you go to sleep. None of this should be the agent's problem.

What an autonomous agent needs is **a memory that lives outside the conversation**. Three layers:

1. **In-context history** — the live conversation, capped by the model window. Goes away when the session resets. Cheap, fast, lossless.
2. **Daily notes** — the agent's raw scratch pad. One markdown file per day. Append-only. Survives reboots, lossless on the day, but unstructured.
3. **The memory bank** — curated, structured, durable. Four categories: `facts`, `decisions`, `projects`, `people`. Each entry is one markdown file. Survives reboots, structured for retrieval, and the LLM does the curation work overnight.

Skills are the parallel idea applied to **behaviour**: instead of editing source code to change what the agent can do, you drop a markdown file describing a procedure, and the agent's system prompt advertises it. The agent picks it up on the next turn. **Personality is data; behaviour is data; memory is data.**

By the end of this level your agent will remember a fact you told it three days ago, survive a daemon restart with the conversation context intact, and gain a new "research" skill from a single markdown file.

### What you will build

By the end of this codelab, you will have:

- A `ContextEngine` that assembles the system prompt from workspace files in a fixed order, cached by aggregate mtime fingerprint
- A `Compactor` that summarises old turns at 80% of the model window, preserving IDs, URLs, and decisions
- A `MemoryBank` with four categories (`facts` / `decisions` / `projects` / `people`), each entry a markdown file with frontmatter
- A `DailyNotes` append-only writer for `workspace/memory/YYYY-MM-DD.md`
- A `Consolidator` that promotes daily notes into bank entries via Gemini-as-curator
- A `SkillsLoader` that lists and loads markdown skills from `workspace/skills/`
- Five new tools on the agent: `memory_save`, `memory_recall`, `daily_append`, `load_skill`, `list_skills`
- A passing `npm test` (~85 tests across the new modules)
- A wow demo: tell your agent something, restart the daemon, ask it back.

## 1. Scaffold and verify

If you skipped Level 1 or want a clean slate, branch from `solutions/level_1` (the answer key for L1) instead of your own copy.

### Continue your L1 codebase

```bash
cd ~/adkclaw/codelab/starter   # or the directory where your L1 work lives
source ~/adkclaw/set_env.sh
git status                     # confirm you're on a clean branch
git checkout -b level-2
```

### Verify L1 still works

```bash
npm test
npm run typecheck
```

Both should pass green. If they don't, fix L1 before continuing.

### Start the daemon

```bash
npm run dev
```

Send a message on Telegram. The agent should reply. Stop the daemon with `Ctrl+C` — we'll restart it many times today.

> **Why a clean L1 baseline matters:** L2 layers four new modules on top of L1. If L1 is half-broken, you'll spend the day debugging the wrong layer.

## 2. The Context Engine — bootstrap from workspace

The system prompt is **not hardcoded**. It is assembled fresh every turn from markdown files in `workspace/`. This is what makes the agent's behaviour editable at runtime: change a file, the next turn picks it up.

### The read order (matters)

```
IDENTITY.md         who am I
USER.md             who is talking to me
SOUL.md             how do I talk
AGENTS.md           behavioural rules
MEMORY.md           what I know long-term (curated)
TOOLS.md            notes about my tool set
memory/<today>.md   raw daily scratch pad
bank/<index>        count + sample of structured memories
skills/             markdown skills (name + one-line description)
HEARTBEAT.md        open tasks
```

Order is load-bearing. Later sections layer on earlier ones. Identity sets the frame; user describes the audience; soul tunes the voice; rules and memory then make sense.

### The mtime-fingerprint cache

If we reread every file every turn, hot paths slow down. The trick: compute an aggregate **fingerprint** from the `mtime` of every file we read. Cache the bootstrap by fingerprint. If `ANY` file's mtime changes, the fingerprint changes, the cache misses, and we rebuild.

That's all it takes for "edit a workspace file → next turn knows" to work.

### Implement `src/context/manager.ts`

Open the file and find the `// REPLACE` markers. Implement:

```typescript
const CORE_FILES: Array<{ filename: string; heading: string }> = [
  { filename: 'IDENTITY.md', heading: 'Identity' },
  { filename: 'USER.md',     heading: 'User' },
  { filename: 'SOUL.md',     heading: 'Soul' },
  { filename: 'AGENTS.md',   heading: 'Agents' },
  { filename: 'MEMORY.md',   heading: 'Memory' },
  { filename: 'TOOLS.md',    heading: 'Tools' },
];

export class ContextEngine {
  private cacheKey: string | null = null;
  private cached: BootstrapResult | null = null;

  bootstrap(): BootstrapResult {
    const fingerprint = this.fingerprint();
    if (this.cacheKey === fingerprint && this.cached) return this.cached;

    const sections: BootstrapSection[] = [];
    for (const { filename, heading } of CORE_FILES) {
      const path = resolve(this.workspacePath, filename);
      if (!existsSync(path)) continue;
      sections.push({ source: filename, heading, content: readFileSync(path, 'utf8') });
    }

    // Append today's daily note
    const today = new Date().toISOString().slice(0, 10);
    const dailyPath = resolve(this.workspacePath, 'memory', `${today}.md`);
    if (existsSync(dailyPath)) {
      sections.push({
        source: `memory/${today}.md`,
        heading: 'Today',
        content: readFileSync(dailyPath, 'utf8'),
      });
    }

    // Append the bank index (Section 4 — implement after MemoryBank)
    sections.push(...this.bankIndexSections());

    // Append skills index (Section 6 — implement after SkillsLoader)
    sections.push(...this.skillsIndexSections());

    // Append HEARTBEAT.md (live tasks)
    const heartbeatPath = resolve(this.workspacePath, 'HEARTBEAT.md');
    if (existsSync(heartbeatPath)) {
      sections.push({
        source: 'HEARTBEAT.md',
        heading: 'Heartbeat',
        content: readFileSync(heartbeatPath, 'utf8'),
      });
    }

    const systemPrompt = sections
      .map((s) => `## ${s.heading} (${s.source})\n\n${s.content}`)
      .join('\n\n---\n\n');

    const result = { systemPrompt, sections, totalChars: systemPrompt.length };
    this.cached = result;
    this.cacheKey = fingerprint;
    return result;
  }

  fingerprint(): string {
    const stamps: string[] = [];
    for (const { filename } of CORE_FILES) {
      const path = resolve(this.workspacePath, filename);
      if (!existsSync(path)) continue;
      stamps.push(`${filename}:${statSync(path).mtimeMs}`);
    }
    // Daily note
    const today = new Date().toISOString().slice(0, 10);
    const dailyPath = resolve(this.workspacePath, 'memory', `${today}.md`);
    if (existsSync(dailyPath)) stamps.push(`memory/${today}:${statSync(dailyPath).mtimeMs}`);
    // Skills directory
    const skillsDir = resolve(this.workspacePath, 'skills');
    if (existsSync(skillsDir)) {
      for (const f of readdirSync(skillsDir)) {
        if (!f.endsWith('.md')) continue;
        stamps.push(`skills/${f}:${statSync(resolve(skillsDir, f)).mtimeMs}`);
      }
    }
    return stamps.join('|');
  }
}
```

### Test it

```bash
npm test src/context/manager.test.ts
```

The tests verify: section order, mtime cache invalidation, missing-file tolerance, and that editing `USER.md` mid-test causes the next bootstrap to see the new content.

> **Common pitfall**: students sometimes use `Date.now()` in the fingerprint. Don't. The fingerprint must depend on **file content's mtime**, not the wall clock.

## 3. Compaction at 80% — surviving long conversations

Gemini 2.5 Pro has a 1M-token window. That sounds infinite — but a chatty agent can fill it in a week. When you cross 80% of the window, you start seeing latency spikes and degraded reasoning. Compaction is how you keep the agent fresh without losing what matters.

### The strategy

1. **Threshold check** — count tokens in the active history (since the last compaction checkpoint). If it exceeds the threshold, compact.
2. **Pick oldest fraction** — by default, the oldest 60% of messages.
3. **Summarise with strict preservation** — send those messages to a cheap model (Gemini 2.5 Flash) with a prompt that **mandates preservation** of:
   - All task IDs, URLs, file paths, opaque identifiers
   - Active tasks and their current status
   - The user's last request
   - Decisions and the reasoning behind them
   - TODOs, open questions, blockers
4. **Replace** — splice the summary into the history in place of the old turns.
5. **Save a checkpoint** — write the summary to a `compaction_checkpoints` table for audit.

### Why a separate cheap model?

The summarisation call is **structural overhead**, not user-facing reasoning. Flash is ~10x cheaper than Pro and good enough at this task. The agent's main loop still uses Pro.

### Implement `src/context/compaction.ts`

```typescript
export const PRESERVATION_RULES = `
PRESERVATION RULES — when you summarize, you MUST preserve:
- All task IDs, URLs, file paths, opaque identifiers
- Active tasks and their current status
- The user's last request
- Decisions and the reasoning behind them
- TODOs, open questions, blockers
- Any pending approvals or asks
Discard chitchat, restated context, and repeated information.
`.trim();

export class Compactor {
  async maybeCompact(sessionKey: string): Promise<CompactionResult | null> {
    const messages = this.sessions.list(sessionKey);
    const tokensBefore = estimateTokensInMessages(messages);
    if (tokensBefore < this.thresholdTokens) return null;

    const fraction = this.summarizeFraction ?? 0.6;
    const cutoff = Math.floor(messages.length * fraction);
    const oldest = messages.slice(0, cutoff);
    const recent = messages.slice(cutoff);

    const transcript = oldest
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    const response = await this.client.models.generateContent({
      model: this.summarizerModel,
      contents: `${PRESERVATION_RULES}\n\nCONVERSATION TO SUMMARIZE:\n${transcript}`,
    });
    const summary = response.text ?? '';

    this.sessions.replaceWithSummary(sessionKey, oldest.length, summary);
    const tokensAfter = estimateTokensInMessages(this.sessions.list(sessionKey));
    return { tokensBefore, tokensAfter, summary, summarizedMessageCount: oldest.length };
  }
}
```

`SessionStore.replaceWithSummary(key, n, summary)` removes the oldest `n` messages and inserts a single `system` message containing the summary, plus writes a checkpoint row.

### Wire it into the agent loop

In `src/index.ts`, after constructing the runner:

```typescript
import { Compactor } from './context/compaction.js';

const compactor = new Compactor({
  client,
  sessions,
  thresholdTokens: Math.floor(MODEL_WINDOW * 0.8),
  summarizerModel: config.gemini.fallbackModel,
});

// Pass to the runner so it calls maybeCompact() before each turn
```

### Test it

```bash
npm test src/context/compaction.test.ts
```

Tests verify the threshold check, that recent messages are preserved, and that the summary message is inserted at position 0 after compaction.

> **Common pitfall**: students sometimes summarise the **last** N messages. Don't — those are the most recent context the agent needs. Summarise the **oldest**.

## 4. The Memory Bank — structured long-term memory

The bank is your agent's encyclopedia. Four categories, each one a folder of markdown files:

```
workspace/bank/
├── facts/         # atomic verified facts about the world or the user
├── decisions/     # choices made, with rationale
├── projects/      # ongoing work, with status
└── people/        # people in the user's circle
```

Each entry is one markdown file with YAML frontmatter:

```markdown
---
name: Prefer SQLite over Postgres for v1 projects
category: decisions
slug: prefer-sqlite-over-postgres-for-v1-projects
created_at: 2026-05-04T12:00:00.000Z
updated_at: 2026-05-04T12:00:00.000Z
---
SQLite is faster for single-host workloads and removes the need for a separate
DB process. Switch to Postgres only when concurrency or replication demands it.
```

### Why not vectors?

A vector DB is overkill at the scale we operate. With <500 entries, a plain `grep`-style scan against name + preview returns better results than a fuzzy embedding nearest-neighbour. Stay simple until simple breaks.

When the bank crosses ~5,000 entries (you'll know — recall starts feeling slow), swap the implementation for Vertex AI Vector Search. The interface stays the same; only `recall()` changes. **Defer the complexity.**

### Implement `src/memory/bank.ts`

```typescript
export const BANK_CATEGORIES = ['facts', 'decisions', 'projects', 'people'] as const;
export type BankCategory = (typeof BANK_CATEGORIES)[number];

export class MemoryBank {
  constructor(opts: { workspacePath: string }) {
    this.bankRoot = resolve(opts.workspacePath, 'bank');
  }

  async save(category: BankCategory, name: string, content: string): Promise<BankEntry> {
    const slug = slugify(name);
    const dir = join(this.bankRoot, category);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${slug}.md`);

    const now = new Date();
    let createdAt = now.getTime();
    if (existsSync(path)) {
      createdAt = (await stat(path)).birthtimeMs || (await stat(path)).mtimeMs;
    }

    const frontmatter = [
      '---',
      `name: ${name}`,
      `category: ${category}`,
      `slug: ${slug}`,
      `created_at: ${new Date(createdAt).toISOString()}`,
      `updated_at: ${now.toISOString()}`,
      '---',
      '',
    ].join('\n');

    await writeFile(path, frontmatter + content.trim() + '\n', 'utf8');
    return { category, name, slug, content: content.trim(), path, createdAt, updatedAt: now.getTime() };
  }

  async list(category?: BankCategory): Promise<BankSummary[]> {
    // Walk one or all categories, parse frontmatter, return summaries sorted by mtime desc
    // (See full implementation in level_2/snapshots/)
  }

  async recall(query: string, opts?: { category?: BankCategory; limit?: number }): Promise<BankSummary[]> {
    const all = await this.list(opts?.category);
    if (!query.trim()) return all.slice(0, opts?.limit ?? 20);
    const q = query.toLowerCase();
    return all
      .filter((e) => e.name.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q))
      .slice(0, opts?.limit ?? 20);
  }
}
```

### Wire the tools

In `src/tools/memory.ts`, three tools wrap the bank:

| Tool | Args | What it does |
|------|------|-------------|
| `memory_save` | `{ category, name, content }` | Save one bank entry |
| `memory_recall` | `{ query?, category?, limit? }` | Search bank entries |
| `daily_append` | `{ text }` | Append to today's daily note (Section 5) |

Register them in `src/index.ts`:

```typescript
registry.register(makeMemorySaveTool(bank));
registry.register(makeMemoryRecallTool(bank));
registry.register(makeDailyAppendTool(daily));
```

### Test it

```bash
npm test src/memory/bank.test.ts
```

Tests verify save/list/recall round-trip, slug normalisation, and frontmatter parsing.

> **Common pitfall**: students sometimes pass `tags` as a third argument. The bank doesn't take tags — categories provide enough partition. If you need richer query, add it to the body and let `recall()` grep.

## 5. Daily Notes + Consolidator — the promotion pipeline

Bank entries are **curated** memory. Daily notes are **raw** memory. The consolidator promotes the second into the first overnight.

### Daily notes — append-only

`workspace/memory/YYYY-MM-DD.md` — one file per day, append-only. The agent (and you) drop notes into it during the day:

```markdown
# Daily Notes — 2026-05-04

- **09:14** Started Level 2. User mentioned preferring SQLite over Postgres.
- **09:42** Sent a quick research summary on Vertex Vector Search.
- **11:02** User decided to defer skill marketplace to Phase 4.
```

Implement `src/memory/daily-notes.ts`:

```typescript
export class DailyNotes {
  async append(text: string, date: Date = new Date()): Promise<void> {
    if (!text.trim()) return;
    await mkdir(this.memoryDir, { recursive: true });
    const path = this.pathFor(date);
    const stamp = date.toTimeString().slice(0, 5);
    const entry = `\n- **${stamp}** ${text.trim()}`;
    if (existsSync(path)) {
      const current = await readFile(path, 'utf8');
      await writeFile(path, current.trimEnd() + '\n' + entry + '\n', 'utf8');
    } else {
      const header = `# Daily Notes — ${this.isoDate(date)}\n${entry}\n`;
      await writeFile(path, header, 'utf8');
    }
  }
}
```

### The consolidator

End of day (or on demand), the consolidator reads the day's note, asks Gemini to extract structured memory, and writes it to the bank:

```typescript
const CONSOLIDATION_PROMPT = `
You're consolidating a day of agent activity into structured long-term memory.

Read the daily notes below. Output JSON with this shape:
{
  "facts":     [{"name": "string", "content": "string"}],
  "decisions": [{"name": "string", "content": "string"}],
  "projects":  [{"name": "string", "content": "string"}],
  "people":    [{"name": "string", "content": "string"}]
}

Rules:
- "facts" = verified, durable facts about the user or the world (not session ephemera).
- "decisions" = choices made today with their rationale.
- "projects" = ongoing work with current status.
- "people" = people mentioned with relevant context.
- Skip categories where nothing belongs.
- Output JSON ONLY, no preamble.

DAILY NOTES:
`.trim();

export class Consolidator {
  async consolidate(date: Date | string = new Date()): Promise<ConsolidationResult> {
    const notes = await this.daily.read(date);
    if (!notes?.trim()) return { date, saved: 0, errors: ['No daily notes'] };

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: `${CONSOLIDATION_PROMPT}\n${notes}`,
    });
    const parsed = parseJsonLoose(response.text ?? '');

    let saved = 0;
    for (const cat of BANK_CATEGORIES) {
      for (const item of parsed[cat] ?? []) {
        if (item.name && item.content) {
          await this.bank.save(cat, item.name, item.content);
          saved += 1;
        }
      }
    }
    return { date, saved, errors: [] };
  }
}
```

`parseJsonLoose()` strips markdown fences if Gemini wrapped the JSON, then falls back to extracting the first `{...}` block — small models sometimes ignore "JSON only".

### When does consolidation run?

Two triggers:
- **End-of-day cron** (Level 3 will give us the cron engine — for now, run manually with `npm run consolidate`)
- **On demand** — the agent can call `consolidate_today` if it explicitly decides "this conversation has enough new facts to promote"

> **Why a separate LLM step?** Without curation, the bank fills with chatter. The consolidator is your editor — it picks what's durable, names it well, and discards noise.

### Test it

```bash
npm test src/memory/daily-notes.test.ts
```

The consolidator has integration tests that mock `client.models.generateContent` and verify the JSON-loose parsing handles fenced output.

## 6. Markdown Skills — runtime extensibility

Tools are **functions** the agent can call. Skills are **procedures** the agent can follow. Both expand what the agent can do — but skills don't require redeploying code.

### What a skill looks like

```markdown
---
name: research-topic
description: Research a topic from multiple sources and produce a structured brief
when_to_invoke: User says "research X", "look into Y", "find sources on Z"
---

## Steps

1. Call `web_search` for the topic — note the top 5 results.
2. For each top result, call `web_fetch` and extract 3–5 key facts.
3. Cross-reference: dedupe facts that appear in multiple sources.
4. Search the memory bank with `memory_recall` — surface anything we already know.
5. Combine into a structured brief: Background → Key facts → Open questions.
6. Save as a fact in the bank with `memory_save`.
7. Return the brief.
```

The agent's system prompt advertises the skill's `description` and `when_to_invoke`. When the conditions match, the agent calls the `load_skill` tool, which returns the body — a procedure to follow.

### Implement `src/skills/loader.ts`

```typescript
export class SkillsLoader {
  async list(): Promise<SkillSummary[]> {
    if (!existsSync(this.skillsDir)) return [];
    const files = await readdir(this.skillsDir);
    const out: SkillSummary[] = [];
    for (const f of files.sort()) {
      if (!f.endsWith('.md')) continue;
      const raw = await readFile(join(this.skillsDir, f), 'utf8');
      const parsed = parseFrontmatter(raw);
      out.push({
        name: f.replace(/\.md$/, ''),
        description: parsed.description,
        whenToInvoke: parsed.whenToInvoke,
        updatedAt: (await stat(join(this.skillsDir, f))).mtimeMs,
      });
    }
    return out;
  }

  async load(name: string): Promise<Skill | null> {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '');
    const path = join(this.skillsDir, `${safeName}.md`);
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf8');
    const parsed = parseFrontmatter(raw);
    return {
      name: safeName,
      description: parsed.description,
      whenToInvoke: parsed.whenToInvoke,
      body: parsed.body,
      path,
      updatedAt: (await stat(path)).mtimeMs,
    };
  }
}
```

`parseFrontmatter` extracts `description` and `when_to_invoke` from the YAML frontmatter; the body is everything after `---\n`.

### Wire two tools

In `src/tools/skills.ts`:

```typescript
export function makeListSkillsTool(loader: SkillsLoader): AgentTool { /* lists names + descriptions */ }
export function makeLoadSkillTool(loader: SkillsLoader): AgentTool { /* returns body of a named skill */ }
```

Register them in `src/index.ts` and add the skills index to `ContextEngine.bootstrap()` so the system prompt advertises them.

### The self-learning loop

Drop one skill into `workspace/skills/`:

```bash
cat > workspace/skills/remember-decisions.md <<'EOF'
---
name: remember-decisions
description: When the user makes a decision, save it as a structured bank entry
when_to_invoke: User says "I prefer X over Y", "let's go with X", "we decided X"
---

## Steps

1. Identify the decision and its rationale.
2. Call `memory_save` with category=`decisions`, a descriptive name, and the rationale.
3. Confirm to the user with the bank entry path.
EOF
```

Restart the daemon. Tell the agent: *"I prefer SQLite over Postgres for v1 projects."* It will recognise the trigger, follow the skill, save to `bank/decisions/prefer-sqlite-over-postgres-for-v1-projects.md`.

Then ask the agent: *"Save what we just did as a skill called 'remember-decisions'."* The agent uses `filesystem` to write a new skill file. Restart. The new skill is now advertised.

That is the **self-learning loop**: the agent watches itself, drafts new skill files, and at the next bootstrap they become part of its repertoire.

### Test it

```bash
npm test src/skills/loader.test.ts
```

Tests verify frontmatter parsing, missing-file tolerance, and that path-traversal attempts (`../../etc/passwd`) are normalised away.

## 7. The wow demo

Now run the full integration test by hand.

### Setup

```bash
npm run build
bin/adkclaw bg
```

### Demo 1 — survives a restart

On Telegram:

> You: Remember I prefer SQLite over Postgres for v1 projects.
> Bot: Got it — saved to `bank/decisions/prefer-sqlite-over-postgres-for-v1-projects.md`. ✓

```bash
bin/adkclaw stop
bin/adkclaw bg
```

> You: What database do I prefer for v1 projects?
> Bot: SQLite — based on a decision you logged earlier today. (`bank/decisions/...`)

The agent **survived a restart** because the answer is on disk.

### Demo 2 — gains a skill from a markdown file

```bash
cat > workspace/skills/research-topic.md <<'EOF'
---
name: research-topic
description: Research a topic from multiple sources, produce a structured brief
when_to_invoke: User says "research X" or "look into Y"
---
## Steps
1. web_search the topic.
2. For each top result, web_fetch + extract key facts.
3. Combine into a brief: Background → Key facts → Open questions.
4. Save as a fact via memory_save.
EOF
```

Restart. Ask: *"Research Vertex AI Vector Search."*

The agent:
1. Lists skills, sees `research-topic`, sees the trigger matches
2. Loads the skill body via `load_skill`
3. Follows the steps — `web_search`, `web_fetch` x3, `memory_save`
4. Returns the structured brief

You taught the agent a new procedure **without writing a line of TypeScript**. Restart-proof, version-controlled, easy to share.

### Demo 3 — compaction in action

In a long Telegram session (~50 turns), watch the logs for:

```
[compaction] tokensBefore=820000 oldest=30 summary=18kb tokensAfter=210000
```

The agent kept reasoning fresh. Open `data/sessions.db` and inspect `compaction_checkpoints` — every compaction has a row with the summary preserved.

## 8. Light up your Level 2 badge

**Trigger**: the memory bank gets its first entry **AND** at least one compaction has run. The agent calls `mark_level_complete` with `level: 2` after both conditions are met in the same session.

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox) (Level 0 → Connect to the Cohort Fleet), your second pillar lights up on the fleet view. If not registered, the call is a no-op locally — no harm done.

## What you have now

Your agent has graduated from "stateful chatbot with tools" to **stateful operator with persistent memory and runtime extensibility**:

- A system prompt that rebuilds from disk every turn (cached by mtime)
- Compaction at 80% so it can sustain hour-long conversations
- A four-category bank that survives reboots and is auditable in plain text
- A daily scratch pad that promotes overnight via Gemini-as-curator
- A skills directory that turns markdown files into agent capabilities

You can teach it new behaviour with a markdown file. You can share that markdown with a teammate. You can revert it with `git checkout`. **Personality is data; behaviour is data; memory is data.**

## What's next

Level 3 turns this single agent into a **team**. You'll add:

- Sub-agents with isolated sessions (Search, Researcher, Communicator, Coder)
- The 5-tier recovery pyramid (retry → fallback → simplify → escape → abort with context)
- Cron + heartbeat — the agent does work while you sleep
- The admin dashboard where you watch all of it from your phone

[Continue to Level 3 — The Agent Army →](https://github.com/dahabit/adkclaw/tree/main/level_3)

---

## Appendix A — Files you touched

| File | Role | What you implemented |
|------|------|----------------------|
| `src/context/manager.ts` | Bootstrap system prompt | `bootstrap()`, `fingerprint()` |
| `src/context/compaction.ts` | Compact history at 80% | `maybeCompact()` with preservation rules |
| `src/context/token-counter.ts` | Approximate token counts | (already provided) |
| `src/memory/bank.ts` | Memory bank CRUD | `save()`, `list()`, `recall()`, `read()` |
| `src/memory/daily-notes.ts` | Append-only daily scratch pad | `append()`, `read()`, `listDates()` |
| `src/memory/consolidator.ts` | Promote daily → bank via LLM | `consolidate()` |
| `src/skills/loader.ts` | Markdown skills loader | `list()`, `load()` |
| `src/tools/memory.ts` | `memory_save`, `memory_recall`, `daily_append` | Tool execute methods |
| `src/tools/skills.ts` | `load_skill`, `list_skills` | Tool execute methods |

## Appendix B — Cost estimate (Level 2)

| Component | Approximate cost |
|-----------|-----------------|
| Gemini Pro turns (~30 testing) | ~$0.50 |
| Compaction LLM calls (~5, on Flash) | ~$0.20 |
| Consolidator LLM call (~1, on Flash) | ~$0.05 |
| Cloud Shell time (free) | $0 |
| **Total per participant** | **~$1** |

Cumulative through L0–L2: ~$2 per participant.

## Appendix C — Troubleshooting

| Issue | Fix |
|-------|-----|
| `Compaction failed: insufficient context` | Threshold too high. Verify it's set to 80% of the model window, not 95%. |
| Bank entries never appear in recall | The `ContextEngine` is caching past file changes. Add the bank directory to your `fingerprint()`. |
| Skill file not advertised in system prompt | YAML frontmatter parse error. Validate with `npx yaml-validator workspace/skills/*.md`. |
| Daily note never appended | `daily_append` tool's path resolution. Check the `TZ` env var matches your machine. |
| Consolidator returns 0 saved entries | Gemini wrapped the JSON in markdown fences. Verify your `parseJsonLoose` strips them. |
| `MAX_TOOL_ROUNDS` hit during research-topic skill | Skill body too aggressive. Cap web_fetch calls to 3 in the steps. |

## Appendix D — Where each concept lives in the production code

The starter scaffold is intentionally simplified. The production reference under `src/` adds:

- **Compaction checkpoints table** with full audit (`src/sessions/store.ts`)
- **Bank index summarisation** for the system prompt (counts + most-recent samples per category)
- **Skill body cache** to avoid re-reading on every `load_skill` call
- **Multi-day daily notes** view for the consolidator (rolls up recent days when one is sparse)

Read those after the codelab to see how each concept matures from "good enough to teach" to "good enough to ship".
