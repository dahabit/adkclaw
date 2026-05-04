# Level 2: Memory & Skills

![Level 2: Memory & Skills](img/memory-architecture.png)

**Give your agent a memory that survives reboots — and the ability to learn new skills from markdown files at runtime, with no redeploy.**

In Level 1 your agent forgot you the moment a session expired. Today it learns to remember **forever** — across reboots, days, even weeks. You'll build the three-tier memory model (in-context history → daily notes → memory bank), implement compaction at 80% to survive 1M-token context windows, and create a markdown-skills loader that lets your agent gain new capabilities by reading new files.

## 🎯 What You'll Learn

| Concept | Description |
|---------|-------------|
| **Three-tier memory model** | Conversation history → daily notes → structured memory bank |
| **Context bootstrap** | Assemble system prompt from `workspace/` files in a fixed order |
| **Mtime-based caching** | Cache invalidation by aggregate file mtime fingerprint |
| **Compaction at 80%** | Summarize oldest history, preserve IDs/URLs/decisions |
| **Memory bank taxonomy** | `bank/{facts,decisions,projects,people}/` — structured retrieval beats vector search at small scale |
| **Daily notes** | One file per day, append-only, raw scratch pad |
| **Consolidator pattern** | Promote daily notes → bank entries with curation |
| **Markdown skills** | Drop a `.md` file → agent gains a capability at next bootstrap |
| **Skill self-creation** | Agent watches its own session, drafts new skill files |

## ✅ What You'll Build

By the end of this level, you will have:

- 🧠 A `ContextEngine` that assembles the system prompt from workspace files in fixed order
- 💾 A `MemoryBank` with 4-folder taxonomy (facts/decisions/projects/people)
- 📝 Daily notes that capture raw events into `workspace/memory/YYYY-MM-DD.md`
- ⚡ Compaction at 80% utilization with `compaction_checkpoints` audit table
- 🎓 A markdown skills loader that surfaces skills in the system prompt
- 🪄 The "self-learning loop" where the agent drafts new skill files

## 📋 Prerequisites

- ✅ **Level 1 completed** — your agent runs on Telegram with conversation memory
- ✅ Cloud Shell environment + `set_env.sh` sourced
- ✅ Familiarity with markdown frontmatter

## 🚀 Quick Start

### 1. Clone and bootstrap

```bash
cd ~/adkclaw/level_2
source ~/adkclaw/set_env.sh
npm install
npm run typecheck
```

### 2. Implement the context bootstrap

Open `src/context/manager.ts` and find the `// REPLACE` markers. Implement:

| Section | What to write |
|---------|---------------|
| `bootstrap()` | Read workspace files in order: IDENTITY → USER → SOUL → AGENTS → MEMORY → today's daily note → bank index → skills → HEARTBEAT |
| `fingerprint()` | Aggregate mtime of every file we read |
| `loadSkills()` | Enumerate `workspace/skills/*.md`, parse frontmatter, surface descriptions |

### 3. Implement the memory bank

Open `src/memory/bank.ts`. Implement:

| Method | What it does |
|--------|-------------|
| `save(category, content, tags)` | Write a markdown file to `workspace/bank/<category>/<id>.md` with frontmatter |
| `recall(category?, query?)` | Grep across bank entries, return matches with relevance |
| `list(category)` | List entry IDs + titles |

### 4. Implement compaction

Open `src/context/compaction.ts`. Implement:

| Method | What it does |
|--------|-------------|
| `checkThreshold(history)` | Returns true at 80% of model context window |
| `compact(history)` | Send oldest N turns to LLM with strict "preserve IDs/URLs/decisions" prompt |
| `saveCheckpoint(...)` | Write to `compaction_checkpoints` table for audit |

### 5. Run the daemon

```bash
npm run dev
```

### 6. Test the wow demo

On Telegram or via REPL:

```
You: Remember I prefer SQLite over Postgres for v1 projects.
Bot: Got it — saved to bank/decisions/dec-...md ✓

[bin/adkclaw stop && bin/adkclaw bg]   ← restart the daemon

You: What database do I prefer for v1?
Bot: SQLite over Postgres — you told me earlier today.
     (bank/decisions/dec-2026-05-04-sqlite.md)
```

The agent **survived a restart** because the decision lives on disk, not in RAM.

### 7. Demonstrate skill self-creation

```
You: Save what we just did as a skill called "remember-decisions".
Bot: Done — workspace/skills/remember-decisions.md.
     Restart and I'll advertise it in my system prompt.
```

`cat workspace/skills/remember-decisions.md` shows the agent's draft. Restart; it's now a listed skill.

## 🏆 Light Up Your Level 2 Badge

**Trigger**: memory bank gets its first fact AND compaction runs once. The agent calls `mark_level_complete` with `level: 2` after both happen in the same session.

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox) (see [Level 0 → Connect to the Cohort Fleet](../level_0/README.md#-optional-connect-to-the-cohort-fleet)), your second pillar lights up on the fleet view. If not registered, no-op.

## 📖 Full Codelab

For detailed step-by-step instructions:

**[📚 Level 2 Codelab →](https://codelabs.developers.google.com/adkclaw-level-2/instructions)**

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Three-Tier Memory                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Conversation history   ← in-context (survives a single turn)  │
│            ↓ (compaction at 80%)                                 │
│                                                                  │
│   Daily notes            ← workspace/memory/YYYY-MM-DD.md        │
│            ↓ (consolidator promotes)                             │
│                                                                  │
│   Memory bank            ← workspace/bank/{facts,decisions,      │
│                            projects,people}/*.md                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔑 Key Patterns

### Context bootstrap with mtime cache

```typescript
// src/context/manager.ts
bootstrap(): BootstrapResult {
  const fingerprint = this.fingerprint();
  if (this.cacheKey === fingerprint && this.cached) return this.cached;

  // Read files in fixed order: IDENTITY → USER → SOUL → AGENTS → MEMORY → today → bank → skills → HEARTBEAT
  const sections = [...];
  const result = { systemPrompt: sections.join('\n\n---\n\n'), ... };

  this.cached = result;
  this.cacheKey = fingerprint;
  return result;
}
```

### Compaction at 80%

```typescript
// src/context/compaction.ts
if (tokenCount > MODEL_WINDOW * 0.8) {
  const oldestN = history.slice(0, Math.floor(history.length / 2));
  const summary = await llm.summarize(oldestN, {
    preserve: ['IDs', 'URLs', 'file paths', 'decisions', 'task status'],
  });
  history.splice(0, oldestN.length, summaryMessage(summary));
  store.saveCheckpoint(sessionKey, summary, oldestN.length);
}
```

### Markdown skill file

```markdown
---
name: research-topic
description: Use when the user asks for research on a topic
when_to_invoke: User says "research X", "look into Y", "find sources on Z"
---

## Steps
1. web_search the topic
2. For each top result: web_fetch + extract key facts
3. Cross-reference, dedupe against memory bank
4. Save new facts to bank/facts/
5. Return structured summary with citations
```

## 💰 Cost

| Component | Approximate Cost |
|-----------|-----------------|
| Gemini Pro turns (~30 testing) | ~$0.50 |
| Compaction LLM calls (~5) | ~$0.20 |
| Cloud Shell time (free) | $0 |
| **Total per participant** | **~$1** |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `Compaction failed: insufficient context` | Threshold too high. Make sure it's 80%, not 95%. |
| Bank entries not surfacing in recall | Check the index isn't being cached past file changes. Verify mtime in fingerprint. |
| Skill file not appearing in system prompt | Frontmatter parse error. Validate YAML in `workspace/skills/*.md`. |
| Daily note not appended | Check `daily_append` tool's path resolution. TZ env var matters. |

## 📁 Files Overview

| File | Purpose | What you implement |
|------|---------|-------------------|
| `src/context/manager.ts` | Bootstrap system prompt | `bootstrap()`, `fingerprint()`, `loadSkills()` |
| `src/context/compaction.ts` | Compact history at 80% | `checkThreshold()`, `compact()`, `saveCheckpoint()` |
| `src/context/token-counter.ts` | Approximate token counting | (provided) |
| `src/memory/bank.ts` | Memory bank CRUD | `save()`, `recall()`, `list()` |
| `src/memory/daily-notes.ts` | Daily scratch pad | `append()` |
| `src/memory/consolidator.ts` | Promote daily → bank | `consolidate()` |
| `src/skills/loader.ts` | Markdown skill loader | `load()` |
| `src/tools/memory.ts` | `memory_save`, `memory_recall`, `daily_append` tools | All execute methods |
| `src/tools/skills.ts` | `load_skill`, `list_skills` tools | All execute methods |

## ➡️ Next Level

Your agent has memory. Time to give it a team and bulletproof reliability.

**[Level 3: The Agent Army →](../level_3/README.md)**

You'll spawn specialized sub-agents (Search, Researcher, Communicator, Coder), implement the recovery pyramid for self-healing, and add cron + heartbeat for true autonomy.

---

*Your agent remembers now. The journey continues.* 🧠
