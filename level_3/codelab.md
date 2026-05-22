author: AdkClaw Team (Ahmed Abu Eldahab — Google Developer Expert in Dart & Flutter, MENA Dev community)
summary: Give your agent persistent memory that survives reboots, and the ability to learn new skills from markdown files at runtime. Build the context engine, the memory bank, daily notes, the consolidator, and the markdown-skills loader.
id: adkclaw-codelab-3-memory-and-skills
categories: ai,ml,gemini,adk,typescript,nodejs,agents,memory
environments: Web
status: Published
feedback link: https://github.com/dahabit/adkclaw/issues
analytics account: 0

# Level 3 — Memory & Skills

## Before you begin

In Level 2 your agent had a brain, three tools, a personality, and a Telegram channel — but it forgot you the moment a session expired. Today it learns to **remember forever** and **gain new skills at runtime, with no redeploy**. This is **Level 3 of 5** in the AdkClaw series.

**PLEASE READ:** This codelab works in either of two environments:

1. **In-person workshop** — sponsored Cloud Shell access; instructions tell you when to use it.
2. **Self-study (your own machine)** — Node.js 22+ on macOS / Linux / Windows + WSL.

The default path below assumes self-study. Branch points are flagged with **(In-person only)** or **(Self-study only)**.

### Prerequisites

✅ **Before starting** — verify all of these first:
- Completed [Level 2 — Build the Brain](https://github.com/dahabit/adkclaw/tree/main/level_2) and have a working agent on Telegram
- Node.js 22+ installed (`node --version` outputs v22.0.0 or later)
- `.env` file with Gemini API key and Telegram bot token (from Level 1)
- `npm install` completed in `level_3/starter/`
- `npm run verify` passes (type-check + offline tests green)
- Familiarity with [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- A working terminal and editor

### What you will learn

- The **three-tier memory model**: in-context history → daily notes → memory bank
- The **context bootstrap pattern**: assemble the system prompt from `workspace/` files in a fixed order, with mtime-based caching
- **Compaction at 80%**: summarise the oldest turns when conversation history pushes against the model window, with strict preservation rules for IDs, URLs, and decisions
- The **memory bank taxonomy** (`facts` / `decisions` / `projects` / `people`) — why structured beats vector search at small scale
- **grep-first search** scaling to **vector embeddings** (RAG): when to add semantic retrieval as the bank grows
- **Daily notes** — append-only timestamped scratch pad, one file per day
- The **consolidator pattern** — promote daily notes into the bank with an LLM-curation step
- **Markdown skills** — drop a `.md` file in `workspace/skills/` and the agent gains a capability at the next bootstrap
- The **self-learning loop** — the agent watches its own session and drafts new skill files

### What you will need

- A computer with **Node.js 22+** installed (`node --version` ≥ v22.0.0)
- A clone of this repo with `cd level_3/starter && npm install` done
- A free [Gemini API key](https://aistudio.google.com/apikey) (already in your `.env` from L1)
- A [Telegram bot token](https://t.me/BotFather) (already in your `.env` from L1)
- A handful of Gemini Pro testing turns and a few compaction calls — comfortably inside the free tier

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
- A clean `npm run build` + `npm run typecheck`, with `npm test` green across the new memory, daily-notes, and skills-loader modules
- A wow demo: tell your agent something, restart the daemon, ask it back.

## 1. Scaffold and verify

Clone the workshop and install Level 2's starter:

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw/level_3/starter
npm install
```

The starter ships as a self-contained TypeScript project. Each L2 concept lives in a file with a `//REPLACE-*` marker + a throwing stub — you fill the markers as you go.

### Verify the starter compiles

```bash
npm run verify
```

This type-checks the project (`tsc --noEmit`) and runs the test suite offline (`vitest run` — no Gemini key, no network). A green pass confirms the starter skeleton compiles and the pre-filled modules are correct. **You'll run `npm run verify` after every section** — it's your checkpoint that nothing regressed.

> **Why per-section verify matters:** L2 layers four new modules on top of L1. If anything breaks, you isolate it to the section you just finished instead of debugging the whole project at the end. The verify gate is structural — `tsc` and `vitest` only, no live agent — so it stays green regardless of which markers are still unfilled.

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

The starter ships `src/context/manager.ts` with the `ContextEngine` class shell, the `CORE_FILES` and `BANK_CATEGORIES` constants, and the helpers (`todayDate`, `safeRead`, `safeMtime`, `extractSkillDescription`) pre-provided. You fill four method bodies, all marked `//REPLACE-CONTEXT-ENGINE`.

#### `bootstrap()` — assemble the system prompt

Open `src/context/manager.ts`, find `//REPLACE-CONTEXT-ENGINE` inside `bootstrap()`, and replace the stub body with:

```typescript
    const fingerprint = this.fingerprint();
    if (this.cacheKey === fingerprint && this.cached) return this.cached;

    const sections: BootstrapSection[] = [];

    for (const { filename, heading } of CORE_FILES) {
      const content = safeRead(resolve(this.workspacePath, filename));
      if (content && content.trim()) {
        sections.push({ source: filename, heading, content: content.trim() });
      }
    }

    const today = todayDate();
    const daily = safeRead(resolve(this.workspacePath, 'memory', `${today}.md`));
    if (daily && daily.trim()) {
      sections.push({
        source: `memory/${today}.md`,
        heading: `Daily note (${today})`,
        content: daily.trim(),
      });
    }

    const bankIndex = this.indexBank();
    if (bankIndex) {
      sections.push({ source: 'bank/', heading: 'Memory Bank Index', content: bankIndex });
    }

    const skills = this.loadSkills();
    if (skills) {
      sections.push({ source: 'skills/', heading: 'Available Skills', content: skills });
    }

    const heartbeat = safeRead(resolve(this.workspacePath, 'HEARTBEAT.md'));
    if (heartbeat && heartbeat.trim()) {
      sections.push({
        source: 'HEARTBEAT.md',
        heading: 'Heartbeat Tasks',
        content: heartbeat.trim(),
      });
    }

    const systemPrompt = sections.map((s) => `# ${s.heading}\n\n${s.content}`).join('\n\n---\n\n');

    const result: BootstrapResult = { systemPrompt, sections, totalChars: systemPrompt.length };
    this.cached = result;
    this.cacheKey = fingerprint;
    return result;
```

#### `fingerprint()` — invalidate cache when any source changes

Find `//REPLACE-CONTEXT-ENGINE` inside `private fingerprint(): string` and replace the stub body with:

```typescript
    const parts: string[] = [];
    for (const { filename } of CORE_FILES) {
      parts.push(`${filename}:${safeMtime(resolve(this.workspacePath, filename))}`);
    }
    const today = todayDate();
    parts.push(
      `memory/${today}.md:${safeMtime(resolve(this.workspacePath, 'memory', `${today}.md`))}`,
    );
    parts.push(`HEARTBEAT.md:${safeMtime(resolve(this.workspacePath, 'HEARTBEAT.md'))}`);
    parts.push(`skills:${safeMtime(resolve(this.workspacePath, 'skills'))}`);
    parts.push(`bank:${safeMtime(resolve(this.workspacePath, 'bank'))}`);
    const skillsDir = resolve(this.workspacePath, 'skills');
    if (existsSync(skillsDir)) {
      try {
        for (const f of readdirSync(skillsDir).sort()) {
          if (f.endsWith('.md')) parts.push(`skills/${f}:${safeMtime(resolve(skillsDir, f))}`);
        }
      } catch {
        // ignore
      }
    }
    return parts.join('|');
```

#### `indexBank()` — sample the bank into a system-prompt slice

Find `//REPLACE-CONTEXT-ENGINE` inside `private indexBank(): string | null` and replace the stub body with:

```typescript
    const bankRoot = resolve(this.workspacePath, 'bank');
    if (!existsSync(bankRoot)) return null;
    const lines: string[] = [];
    for (const cat of BANK_CATEGORIES) {
      const dir = resolve(bankRoot, cat);
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir).filter((f) => f.endsWith('.md'));
        if (entries.length === 0) continue;
        const sample = entries.slice(0, 10).join(', ');
        const more = entries.length > 10 ? ', ...' : '';
        lines.push(`- **${cat}** (${entries.length}): ${sample}${more}`);
      } catch {
        // skip
      }
    }
    return lines.length > 0 ? lines.join('\n') : null;
```

#### `loadSkills()` — advertise available markdown skills

Find `//REPLACE-CONTEXT-ENGINE` inside `private loadSkills(): string | null` and replace the stub body with:

```typescript
    const dir = resolve(this.workspacePath, 'skills');
    if (!existsSync(dir)) return null;
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
      if (files.length === 0) return null;
      const out: string[] = [];
      for (const f of files.sort()) {
        const content = safeRead(resolve(dir, f));
        if (!content) continue;
        out.push(`- **${f.replace(/\.md$/, '')}** — ${extractSkillDescription(content)}`);
      }
      return out.length > 0 ? out.join('\n') : null;
    } catch {
      return null;
    }
```

> **Important:** `fingerprint()` MUST sample every file/directory that `bootstrap()` reads. Miss one (the bank, the skills directory, HEARTBEAT.md) and the cache won't invalidate when that source changes — your "edit a file → next turn knows" demo will silently break.

**Checkpoint** — run `npm run verify`. Still green. The four method bodies type-check together; the live behaviour (re-bootstrap on edit) is exercised in §7's wow demo.

> **Common pitfall**: students sometimes use `Date.now()` in the fingerprint. Don't. The fingerprint must depend on **file content's mtime**, not the wall clock.

## 3. Compaction at long-context boundaries — surviving long conversations

Gemini 2.5 Pro has a 1M-token window. That sounds infinite — but a chatty agent can fill it in a week, and reasoning quality **degrades smoothly** below the ceiling, not at a cliff edge. Compaction is how you keep the agent fresh without losing what matters.

> **Where to set the threshold:** there's no magic number. We default to **70–80% of the model window** because empirically that's where latency starts to climb on hot prompts. Lower the threshold (60%) for cost-sensitive setups; raise it (90%) if your turns are short and you want to preserve maximum recent context. The threshold is a `Compactor` constructor option — change it as your traffic shape changes.

### The strategy

1. **Threshold check** — count tokens in the active history (since the last compaction checkpoint). If it exceeds the configured threshold, compact.
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

### Fill the `CONTEXT-TOKENS` marker — `src/context/token-counter.ts`

The starter ships `src/context/token-counter.ts` with the imports and two function signatures pre-provided. Open the file, find both `//REPLACE-CONTEXT-TOKENS` markers, and replace each stub body:

```typescript
  // body of estimateTokens()
  if (!text) return 0;
  return Math.ceil(text.length / 4);
```

```typescript
  // body of estimateTokensInHistory()
  let total = 0;
  for (const c of history) {
    for (const part of c.parts ?? []) {
      if (typeof part.text === 'string') total += estimateTokens(part.text);
      if (part.functionCall) total += estimateTokens(JSON.stringify(part.functionCall));
      if (part.functionResponse) total += estimateTokens(JSON.stringify(part.functionResponse));
    }
  }
  return total;
```

For exact counts later, swap in `client.models.countTokens({ model, contents })`.

### Fill the `CONTEXT-COMPACTION` marker — `src/context/compaction.ts`

The starter ships `src/context/compaction.ts` with imports, `PRESERVATION_RULES`, `CompactorOptions` / `CompactionResult` interfaces, the `contentToLine` helper, and the `Compactor` class shell + constructor pre-provided. Open the file, find `//REPLACE-CONTEXT-COMPACTION` inside `maybeCompact()`, and replace the stub body with:

```typescript
    const history = this.sessions.history(sessionKey);
    const tokensBefore = estimateTokensInHistory(history);
    if (tokensBefore < this.thresholdTokens || history.length < 4) return null;

    const cutoff = Math.max(1, Math.floor(history.length * this.summarizeFraction));
    const oldest = history.slice(0, cutoff);
    const transcript = oldest.map(contentToLine).join('\n');

    let summary = '';
    try {
      const response = await this.client.models.generateContent({
        model: this.summarizerModel,
        contents: `${PRESERVATION_RULES}\n\nCONVERSATION TO SUMMARIZE:\n${transcript}`,
      });
      summary = (response.text ?? '').trim();
    } catch (e) {
      summary = `[Compaction failed: ${e instanceof Error ? e.message : String(e)}]`;
    }
    if (!summary) return null;

    this.sessions.replaceWithSummary(sessionKey, cutoff, summary);
    const tokensAfter = estimateTokensInHistory(this.sessions.history(sessionKey));
    return { tokensBefore, tokensAfter, summary, summarizedMessageCount: cutoff };
```

`SessionStore.replaceWithSummary(key, n, summary)` removes the oldest `n` messages and inserts a single `system` message containing the summary, plus writes a checkpoint row.

### Wire it into the channel handlers

The compactor doesn't live on the agent loop — the runner is single-turn and stateless. Each **channel** (HTTP + Telegram) decides whether to compact *before* it pulls history off the session store. That keeps the policy ("when to summarize") next to the I/O ("when do we read history?") instead of buried in the runner.

In `src/index.ts`, after constructing `sessions`:

```typescript
import { Compactor } from './context/compaction.js';

const compactor = new Compactor({
  client,
  sessions,
  thresholdTokens: Math.floor(MODEL_WINDOW * 0.8),
  summarizerModel: config.gemini.fallbackModel,
});

const app = createHttpServer(config, runner, contextEngine, sessions, compactor);
// ...
const tg = new TelegramAdapter(config, runner, contextEngine, sessions, compactor);
```

In each channel, call `compactor.maybeCompact(session.key)` **before** reading history. From `src/channels/telegram.ts`:

```typescript
// Compact old turns before reading history, so the run stays under budget.
await this.compactor.maybeCompact(session.key);
const history = this.sessions.history(session.key);
```

`maybeCompact()` is a no-op when the session is below threshold, so it's cheap to call on every turn — no policy logic leaks into the channel.

**Checkpoint** — run `npm run verify`. Green. The compaction path is exercised live in §7's wow demo (the long-session demo).

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

### Why grep first, vectors later?

Two different search problems. Grep wins on **exact-term match** (the user types "SQLite" and an entry titled "Prefer SQLite over Postgres" is the obvious hit). Vector search wins on **semantic recall** (the user types "what databases do I prefer?" and you want to retrieve the SQLite decision even though the word "database" never appears in the entry).

For the small bank we start with, both approaches work, but grep is dramatically simpler:

| Bank size | Grep latency | Vector latency | Recommendation |
|-----------|--------------|----------------|----------------|
| <500 entries | ~10ms | ~50ms (cold) | **Grep** — semantic gains rarely justify infrastructure |
| 500–5,000 | ~50–200ms | ~50ms | **Grep with monitoring** — start logging `recall()` latency. If it crosses 200ms regularly, that's the migration signal. |
| >5,000 | >500ms | ~50ms | **Vertex AI Vector Search** — the interface stays identical, only `recall()` changes. |

Stay simple until simple breaks. **Add embeddings the day grep latency starts hurting**, not before. The instrumentation hint: log `MemoryBank.recall()` duration on every call — your migration trigger is data, not vibes.

### ✅ Section recap — Memory bank foundations

You now have:
- A four-category memory bank (`facts` / `decisions` / `projects` / `people`) in plain-text markdown with frontmatter
- A `memory_save` tool to write bank entries from the agent's chat
- A `memory_recall` tool to search by substring (the grep strategy)
- Infrastructure ready to upgrade to vector search once the bank grows

**Learner success criteria:**
- `npm test src/memory/bank.test.ts` passes
- You can save and recall a bank entry via the tools
- You understand why grep comes first and vectors scale later

### Study the `MemoryBank` — `src/memory/bank.ts` (pre-provided)

> **Pre-provided in the starter** — `src/memory/bank.ts` ships complete because the file is exercised by its own test suite (`bank.test.ts`); marker-blanking would break `npm run verify`. Read it; the design below is the canonical reference. Same applies to `daily-notes.ts` and `consolidator.ts` in §5.

#### `save()` — write one bank entry

```typescript
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
    return {
      category,
      name,
      slug,
      content: content.trim(),
      path,
      createdAt,
      updatedAt: now.getTime(),
    };
```

#### `list()` — index every entry across all four categories

```typescript
    const out: BankSummary[] = [];
    const cats: readonly BankCategory[] = category ? [category] : BANK_CATEGORIES;
    for (const cat of cats) {
      const dir = join(this.bankRoot, cat);
      if (!existsSync(dir)) continue;
      for (const f of await readdir(dir)) {
        if (!f.endsWith('.md')) continue;
        const path = join(dir, f);
        const raw = await readFile(path, 'utf8');
        const body = raw.replace(/^---\n[\s\S]*?\n---\n+/, '');
        const preview = body.split('\n').slice(0, 2).join(' ').slice(0, 200);
        const s = await stat(path);
        const slug = f.replace(/\.md$/, '');
        const name = raw.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? slug;
        out.push({ category: cat, slug, name, preview, updatedAt: s.mtimeMs });
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
```

#### `recall()` — case-insensitive substring filter over `list()`

```typescript
    const all = await this.list(opts?.category);
    if (!query.trim()) return all.slice(0, opts?.limit ?? 20);
    const q = query.toLowerCase();
    return all
      .filter((e) => e.name.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q))
      .slice(0, opts?.limit ?? 20);
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

## 4.5. RAG in practice: from grep to vectors

The `memory_recall()` tool uses exact-substring matching. For a bank of 10–500 entries that works well — but as the bank grows, you hit a ceiling: the agent can't retrieve entries it doesn't know to search for. If the bank contains *"SQLite is faster for single-host workloads"* and the user asks *"what database scales better?"*, grep on "database" or "scale" might miss it.

**Retrieval-Augmented Generation** (RAG) solves this by **embedding** both the bank entries and the query into a shared semantic space, then retrieving the top-k entries by similarity. This works because embeddings capture meaning, not just keywords.

### The five-step pipeline

1. **Chunk** — break each bank entry into ~passage-sized pieces (100–300 tokens each). A decision about SQLite might stay as one chunk; a long fact list breaks into multiple chunks.
2. **Embed** — send each chunk to `gemini-embedding-2` to get a dense vector.
3. **Store** — keep the vectors in memory (for this codelab) or in a vector database like Firestore Vector Search (for production).
4. **Retrieve** — when the agent searches, embed the query and find the top-k chunks by cosine similarity.
5. **Ground** — pass the retrieved chunks as context to the model when generating the answer.

### A light implementation — in-memory RAG

Here's a runnable example that banks passages into an in-memory vector store and retrieves by cosine similarity:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

interface EmbeddedChunk {
  text: string;
  embedding: number[];
}

async function embedChunk(text: string): Promise<number[]> {
  const response = await client.models.embedContent({
    model: 'gemini-embedding-2',
    content: text,
  });
  return response.embedding?.values || [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
  const magB = Math.sqrt(b.reduce((sum, x) => sum + x * x, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

async function retrieveTopK(
  query: string,
  bank: EmbeddedChunk[],
  k: number = 5,
): Promise<EmbeddedChunk[]> {
  const queryEmbedding = await embedChunk(query);
  const scored = bank.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, k).map((x) => x.chunk);
}

// Example usage:
const bank: EmbeddedChunk[] = [
  {
    text: 'SQLite is faster for single-host workloads and removes the need for a separate DB process.',
    embedding: await embedChunk('SQLite is faster for single-host workloads...'),
  },
  {
    text: 'Switch to Postgres only when concurrency or replication demands it.',
    embedding: await embedChunk('Switch to Postgres only when...'),
  },
];

const results = await retrieveTopK('what database scales better?', bank);
console.log(results); // finds SQLite passage via semantic similarity
```

### Chunking notes

- **Small entries** (decisions, facts) — keep whole; they are already concise.
- **Large documents** — split by paragraph or by semantic boundary (e.g., "## Design Pattern" headings). Avoid cutting mid-sentence.
- **Metadata** — preserve the entry's `name` and `category` with each chunk so the agent knows where the answer came from.
- **Overlap** — optional: include the last sentence of chunk *i* at the start of chunk *i+1* to preserve context across boundaries.

### Retrieval quality — how to tell it worked

1. **Re-rank with BM25** — after embedding-based retrieval, re-score results using keyword overlap (BM25) to catch exact-term matches. Use the higher score: `max(embedding_score, bm25_score)`.
2. **Log retrieval metrics** — on every `recall()` call, log: query, top-3 results, their scores, and whether any matched exactly. Spot trends where the agent says "I don't see that" — that is a retrieval miss.
3. **Test with paraphrases** — ask "what database scales?" vs. "postgres vs sqlite?" — both should surface the same facts.

### Production upgrade path

This in-memory implementation scales to ~1,000 passages. Beyond that:

- **Firestore Vector Search** — managed, auto-indexed, scales to millions, mutable (no re-embedding entire bank after edits).
- **The interface stays identical** — swap the `retrieveTopK()` implementation; the agent's tools don't change.
- **Lazy migration** — keep grep-based `recall()` as default. Expose a `recall_semantic` tool alongside it. Let the agent pick based on the user's query.

> **Why not use vectors from day one?** Vectors add latency (~50ms per query), cost (embedding quota), and operational surface (vector index lifecycle). Start with grep, measure `recall()` latency, and add vectors **the day grep reaches 200ms**.

> ℹ️ **Vector search in Level 3** — This section teaches the *concepts*. For a full implementation, add the above code to a `src/memory/vector-store.ts` module, wire it into `MemoryBank`, and test with `npm test src/memory/vector-store.test.ts`. Level 4 connects it to the live agent.

✅ **Section recap — RAG readiness**

You now understand:
- When to use grep (small, <500 entries) vs. vectors (semantic, scales)
- The five-step embedding pipeline (chunk → embed → store → retrieve → ground)
- How to implement cosine-similarity retrieval in-memory
- Chunking strategy and quality signals for retrieval

**Learner success criteria:**
- You can explain when grep breaks and vectors help
- You can run the in-memory RAG example and retrieve a passage by semantic query

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

### Study `DailyNotes` — `src/memory/daily-notes.ts` (pre-provided)

`src/memory/daily-notes.ts` is also pre-provided. Its `append()` looks like:

```typescript
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
```

### The consolidator

End of day (or on demand), the consolidator reads the day's note, asks Gemini to extract structured memory, and writes it to the bank:

### Study `Consolidator` — `src/memory/consolidator.ts` (pre-provided)

`src/memory/consolidator.ts` is pre-provided. The pipeline `consolidate()` runs at end-of-day:

```typescript
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
```

#### `parseJsonLoose()` helper

`parseJsonLoose()` strips markdown fences if Gemini wrapped the JSON, then falls back to extracting the first `{...}` block — small models sometimes ignore "JSON only":

```typescript
  // Strip markdown fences if Gemini wrapped it
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as ParsedConsolidation;
  } catch {
    // Try to extract first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as ParsedConsolidation;
      } catch {
        return {};
      }
    }
    return {};
  }
```

### When does consolidation run?

In Level 2 it's a library you can call manually from a Node REPL — no scheduler yet. The runtime trigger lands in Level 4 alongside the heartbeat:

- **Heartbeat-driven (L3)** — every 30 minutes during work hours, the heartbeat hands the agent a tick. The agent reads `workspace/HEARTBEAT.md` and `workspace/memory/<today>.md` and may decide *"there's enough new material; promote it now"* by calling its `daily_append` / `memory_save` tools or by invoking the `Consolidator` programmatically from a custom skill. There is no `consolidate_today` Gemini tool by default — the agent uses the same memory tools it already has.
- **End-of-day cron (L3, optional)** — you can add a `cron_add` for a midnight job that imports `Consolidator` and calls `consolidate(yesterday)`. Wire it yourself; the engine exposes the API.

> **Why a separate LLM step?** Without curation, the bank fills with chatter. The consolidator is your editor — it picks what's durable, names it well, and discards noise.

> **What about a `consolidate_today` tool?** Earlier drafts of the workshop exposed one. We removed it because two tools (`daily_append` for capture + `memory_save` for promote) already cover the user-visible surface; a third tool would just rename the same call. If your students want it, the `Consolidator.consolidate()` method is one tool wrapper away — same shape as the other memory tools.

### Test it

```bash
npm test src/memory/daily-notes.test.ts
```

The consolidator has integration tests that mock `client.models.generateContent` and verify the JSON-loose parsing handles fenced output.

✅ **Section recap — Daily notes & consolidation**

You now have:
- A `DailyNotes` append-only writer that timestamps every entry with the day's file surviving reboots
- A `Consolidator` that reads daily notes and promotes significant entries into the memory bank via Gemini-as-curator
- Five new tools on the agent: `memory_save`, `memory_recall`, `daily_append`, `load_skill`, `list_skills`

**Learner success criteria:**
- `npm test src/memory/daily-notes.test.ts` passes
- You can append to today's daily note via the `daily_append` tool
- You understand why the consolidator acts as editor instead of storing raw daily notes directly in the bank

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

### Read `src/skills/loader.ts` (pre-provided)

`SkillsLoader` is **pre-provided** in your starter — read it, don't rewrite it. The mechanical work (frontmatter parsing, filename whitelisting) is boilerplate; the *lesson* is the runtime extensibility pattern this enables. The unit tests already exercise the loader's surface (frontmatter, missing files, path-traversal rejection), so you can trust the behaviour and focus on wiring it into the agent.

The shape that matters:

```typescript
export class SkillsLoader {
  // List all skills (name + description) for the system prompt to advertise.
  async list(): Promise<SkillSummary[]>;

  // Load one skill body by name. Returns null if not found.
  // Filename is sanitised — '../../etc/passwd' is normalised to 'etcpasswd' and misses.
  async load(name: string): Promise<Skill | null>;
}
```

Internally `list()` reads `workspace/skills/*.md`, parses YAML frontmatter to extract `description` and `when_to_invoke`, and returns metadata for the system prompt. `load(name)` whitelists the filename to alphanumerics + `._-` (a defence against `../` traversal), reads the markdown, and returns the parsed body — the *procedure* the agent will follow.

> **Why this is pre-provided.** It's defensive file I/O with no agent-specific logic. The Level 2 lesson is *what skills enable* (runtime extensibility, self-learning loop), not "how do you parse YAML?". Tests under `src/skills/loader.test.ts` ship green; if you want to read the implementation, open the file in your editor — the whole thing fits on one screen.

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

> **Security note:** the character whitelist (`replace(/[^a-zA-Z0-9._-]/g, '')`) is **safe by accident** — it strips `/` and `..` so `../../etc/passwd` becomes `etcpasswd` which doesn't exist as a skill, so `load()` returns `null`. For a more defence-in-depth approach, **also** verify the resolved path stays under `skillsDir` using `realpath`:
>
> ```typescript
> import { realpathSync } from 'node:fs';
> const resolved = realpathSync(path);
> if (!resolved.startsWith(realpathSync(this.skillsDir))) return null;
> ```
>
> Combine the two — input sanitisation **and** path validation. Belt and braces.

✅ **Section recap — Markdown skills & extensibility**

You now have:
- A `SkillsLoader` that reads markdown skills from `workspace/skills/` and advertises them in the system prompt
- A `load_skill` tool the agent uses to fetch a skill's procedure body at runtime
- A `list_skills` tool to enumerate available skills with their descriptions
- The self-learning loop: agent watches itself, drafts new skill files, and gains capabilities without redeployment

**Learner success criteria:**
- `npm test src/skills/loader.test.ts` passes
- You can drop a `.md` file in `workspace/skills/`, restart, and the agent lists it
- You understand why procedures-as-data enable runtime extensibility

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

## 8. Prerequisites checklist

Before starting Level 3, verify:

- ✅ **Node.js 22+**: `node --version` outputs `v22.0.0` or later
- ✅ **Level 2 complete**: You have a working agent from `level_2/starter` with Telegram integration
- ✅ **`.env` file**: Your Gemini API key and Telegram bot token are set in `level_3/starter/.env`
- ✅ **npm install done**: You ran `npm install` in `level_3/starter/`
- ✅ **`npm run verify` passes**: Type-check and offline test suite green before you start

## 9. Light up your Level 3 badge

**Trigger**: the memory bank gets its first entry **AND** at least one compaction has run. The agent calls `mark_level_complete` with `level: 3` after both conditions are met in the same session.

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox) (Level 1 → Connect to the Cohort Fleet), your third pillar lights up on the fleet view. If not registered, the call is a no-op locally — no harm done.

## What you built

This codelab delivered:
- **Context bootstrap** — system prompt rebuilt from disk every turn, cached by mtime fingerprint
- **Compaction at threshold** — history summarised at 70–80% of model window, preserving IDs/URLs/decisions
- **Memory bank** — four-category structured recall (grep-first, vector-upgrade path included)
- **Daily notes + consolidator** — raw append-only notes promoted to bank via LLM-as-editor
- **Markdown skills** — procedure-as-data for runtime extensibility
- **Self-learning loop** — agent drafts new skill files; bootstrap picks them up
- **RAG readiness** — in-memory embedding example for when grep hits its 500-entry ceiling

**What you have now**

Your agent has graduated from "stateful chatbot with tools" to **stateful operator with persistent memory and runtime extensibility**:

- A system prompt that rebuilds from disk every turn (cached by mtime)
- Compaction at the 70–80% boundary so it can sustain hour-long conversations
- A four-category bank that survives reboots and is auditable in plain text
- A daily scratch pad that promotes overnight via Gemini-as-curator
- A skills directory that turns markdown files into agent capabilities

You can teach it new behaviour with a markdown file. You can share that markdown with a teammate. You can revert it with `git checkout`. **Personality is data; behaviour is data; memory is data.**

## Glossary

| Term | Definition |
|------|-----------|
| **Bootstrap** | Assemble the system prompt from workspace files in a fixed order, cached by mtime fingerprint |
| **Compaction** | Summarise the oldest ~60% of conversation history when token count exceeds threshold (70–80% of window) |
| **Memory bank** | Four-category structured store (`facts`, `decisions`, `projects`, `people`), each entry a markdown file with frontmatter |
| **Daily notes** | Append-only timestamped scratch pad, one file per day, lives in `workspace/memory/YYYY-MM-DD.md` |
| **Consolidator** | LLM-as-curator that reads daily notes and promotes significant entries to the bank |
| **Markdown skills** | Procedures-as-data; drop a `.md` file in `workspace/skills/`, agent picks it up at next bootstrap |
| **Self-learning loop** | Agent watches itself, drafts new skill files, gains capabilities without code redeploy |
| **RAG** | Retrieval-Augmented Generation; embed bank passages + query, retrieve top-k by similarity, ground model's answer |
| **Embedding** | Dense vector representation of text meaning (from `gemini-embedding-2`) |
| **Chunking** | Break large documents into ~passage-sized pieces before embedding |
| **Cosine similarity** | Metric for semantic distance between vectors; ranges [0, 1] where 1 = identical meaning |

## What's next

Level 4 turns this single agent into a **team**. You'll add:

- Sub-agents with isolated sessions (Search, Researcher, Communicator, Coder)
- The 5-tier recovery pyramid (retry → fallback → simplify → escape → abort with context)
- Cron + heartbeat — the agent does work while you sleep
- The admin dashboard where you watch all of it from your phone

[Continue to Level 4 — The Agent Army →](https://github.com/dahabit/adkclaw/tree/main/level_4)

---

## Appendix A — Prerequisites & success criteria

### Before you begin
- Completed Level 2 and have a working agent on Telegram
- Node.js 22+ installed
- `.env` file with Gemini API key and Telegram bot token from Level 1
- `npm install` run in `level_3/starter/`
- `npm run verify` passes (type-check + offline tests)

### Success criteria per section
- **§1 Scaffold**: `npm run verify` green; starter type-checks
- **§2 Context Engine**: Edit `bootstrap()`, `fingerprint()`, `indexBank()`, `loadSkills()`; `npm run verify` green
- **§3 Compaction**: Edit token-counter and compaction; wire into both channels (HTTP + Telegram)
- **§4 Memory Bank**: Save and recall entries; `npm test src/memory/bank.test.ts` green
- **§4.5 RAG**: Understand when grep scales to vectors; run the in-memory cosine-similarity example
- **§5 Daily + Consolidator**: Append notes; `npm test src/memory/daily-notes.test.ts` green
- **§6 Skills**: Drop a markdown skill in `workspace/skills/`, restart, agent lists it; `npm test src/skills/loader.test.ts` green
- **§7 Wow demo**: Agent survives a daemon restart and retrieves a saved fact; gains a skill from a markdown file
- **§9 Badge**: First bank entry **AND** at least one compaction recorded; agent calls `mark_level_complete` with `level: 3`

## Appendix B — Files you touched

| File | Role | What you did |
|------|------|--------------|
| `src/context/manager.ts` | Bootstrap system prompt | Filled `//REPLACE-CONTEXT-ENGINE` — implemented `bootstrap()`, `fingerprint()` |
| `src/context/compaction.ts` | Compact history at configured threshold (70–80% default) | Filled `//REPLACE-CONTEXT-COMPACTION` — implemented `maybeCompact()` with preservation rules; wired it into both channels (HTTP + Telegram) |
| `src/context/token-counter.ts` | Approximate token counts | Filled `//REPLACE-CONTEXT-TOKENS` (×2) — implemented `estimateTokens()` + `estimateTokensInHistory()` |
| `src/memory/bank.ts` | Memory bank CRUD | (pre-provided — `save()`, `list()`, `recall()`, `read()`. Read + use it.) |
| `src/memory/daily-notes.ts` | Append-only daily scratch pad | (pre-provided — `append()`, `read()`, `listDates()`) |
| `src/memory/consolidator.ts` | Promote daily → bank via LLM | (pre-provided — `consolidate()`, runs on cron in Level 3) |
| `src/skills/loader.ts` | Markdown skills loader | (pre-provided — `list()`, `load()`) |
| `src/tools/memory.ts` | `memory_save`, `memory_recall`, `daily_append` | Registered the tool factories in `src/index.ts` |
| `src/tools/skills.ts` | `load_skill`, `list_skills` | Registered the tool factories in `src/index.ts` |

## Appendix C — Troubleshooting

| Issue | Fix |
|-------|-----|
| `Compaction failed: insufficient context` | Threshold too high. Configure `thresholdTokens` in the 70–80% range of your model window. |
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
