# Level 2 — Resources

Curated links + ideas for students AND instructors. Same template as L1.

---

## Reference docs

### Memory architecture + context engineering
- [Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents) — three-tier memory and the "context, not weights" framing
- [LangChain Memory concepts](https://python.langchain.com/docs/concepts/memory) — alternate vendor's vocabulary (compare, don't copy)
- [Lilian Weng — LLM-powered Autonomous Agents §3 Memory](https://lilianweng.github.io/posts/2023-06-23-agent/) — canonical academic overview

### Compaction + summarisation
- [Anthropic — Memory and context management](https://docs.anthropic.com/en/docs/agents-and-tools/memory) — strict-preservation patterns we copy
- [Gemini — Long context guide](https://ai.google.dev/gemini-api/docs/long-context) — when long context helps and when it doesn't
- [Token counting in Gemini](https://ai.google.dev/gemini-api/docs/tokens) — the heuristic we approximate

### Markdown skills + procedural memory
- [Anthropic — Agent Skills](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview) — same idea, structured spec
- [GitHub Copilot Workspace skills](https://github.blog/changelog/) — runtime extensibility comparison
- [`workspace.example/skills/`](https://github.com/dahabit/adkclaw/tree/main/workspace.example/skills) — what we ship

### File-based memory (vs vector DBs)
- [Simon Willison — Embeddings, not always](https://simonwillison.net/) — when grep beats embeddings
- [SQLite FTS5](https://www.sqlite.org/fts5.html) — full-text search if you outgrow plain grep
- [Vertex AI Vector Search](https://cloud.google.com/vertex-ai/docs/vector-search/overview) — what to graduate to past 5K entries

---

## Sister codelabs from Google

| For our pillar | Google codelab | Why |
|----------------|----------------|-----|
| Memory architecture | [Building Stateful and Personalized Agents with ADK](https://codelabs.developers.google.com/codelabs/agent-memory/instructions) | Same three-tier model, Python + ADK |
| Long-context handling | [Gemini Long Context guide](https://ai.google.dev/gemini-api/docs/long-context) | When the 1M window helps |
| Skills / tools dichotomy | [Building ADK Agents with Skills and Tools](https://codelabs.developers.google.com/next26/dev-keynote/building-agents-with-skills) | The MCP-tools direction |
| Vector search graduation | [Vertex AI Vector Search quickstart](https://cloud.google.com/vertex-ai/docs/vector-search/quickstart) | Where to go past 5K bank entries |

---

## Sample prompts to demo (test your agent with these)

### After Chapter 4 (Memory bank)
```
Remember I prefer SQLite over Postgres for v1 projects.
Save this as a fact: Vertex AI Vector Search costs $0.20/GB-month.
What do you know about my database preferences?
List everything in your memory bank under decisions.
```

### After Chapter 5 (Daily notes + consolidator)
```
Note: had a productive Level 2 session today.
Append to today's note: Decided to defer skill marketplace to Phase 4.
Run the consolidator on yesterday's notes and tell me what you saved.
```

### After Chapter 6 (Skills)
```
What skills do you have?
Use the research-topic skill to look into Vertex AI Vector Search pricing.
Save what we just did as a skill called "remember-decisions".
```

### Stress-test prompts
```
[After 50+ turns]: Tell me what we discussed at the start of this conversation.
                   (verifies compaction preserved the user's first request)

Save 100 facts about Flutter.   (tests bank scaling)

Load skill "../../etc/passwd".  (tests path-traversal block)

Search the bank for "decision". (tests recall query matching)
```

---

## Inspiration — articles, talks, tweets

### On agent memory
- [Anthropic — Memory and context management](https://docs.anthropic.com/en/docs/agents-and-tools/memory) — the strict-preservation doctrine
- [Cline — Memory bank pattern](https://github.com/cline/cline) — open-source agent that popularised the markdown bank
- [Letta (formerly MemGPT)](https://research.memgpt.ai/) — academic framing of LLM as OS with memory tiers

### On compaction
- [Long-context retrieval — research overview](https://arxiv.org/abs/2310.06825) — why summarisation beats sliding-window for long agents
- [Anthropic — Compaction in Claude Code](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — adjacent pattern (cache control, not summarisation)

### On skills as data
- [Anthropic — Agent Skills overview](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview) — same shape, different format
- [Cursor Rules](https://docs.cursor.com/context/rules) — markdown rules surfaced into the editor agent
- [Continue.dev rules + slash commands](https://docs.continue.dev/) — converging design across editor agents

---

## Deep dives — for students who want to go beyond Level 2

### After Chapter 2 (Context engine)
- Read [`src/context/manager.ts`](https://github.com/dahabit/adkclaw/blob/main/src/context/manager.ts) full version — see how the bank index is summarised (count + samples) for token economy
- Read [`src/context/manager.test.ts`](https://github.com/dahabit/adkclaw/blob/main/src/context/manager.test.ts) — the cache-invalidation cases worth understanding

### After Chapter 3 (Compaction)
- Read [`src/context/compaction.ts`](https://github.com/dahabit/adkclaw/blob/main/src/context/compaction.ts) full version — see the `compaction_checkpoints` table writes
- Read [`src/context/token-counter.ts`](https://github.com/dahabit/adkclaw/blob/main/src/context/token-counter.ts) — the approximation we use vs Gemini's exact `countTokens` API

### After Chapter 4 (Memory bank)
- Read [`src/memory/bank.ts`](https://github.com/dahabit/adkclaw/blob/main/src/memory/bank.ts) — the production CRUD
- Read [`src/tools/memory.ts`](https://github.com/dahabit/adkclaw/blob/main/src/tools/memory.ts) — how the tool wrappers expose `save` / `recall` / `daily_append`

### After Chapter 5 (Consolidator)
- Read [`src/memory/consolidator.ts`](https://github.com/dahabit/adkclaw/blob/main/src/memory/consolidator.ts) — `parseJsonLoose()` for fenced-output recovery
- Read [`workspace.example/memory/`](https://github.com/dahabit/adkclaw/tree/main/workspace.example/memory) — sample daily notes

### After Chapter 6 (Skills)
- Read [`src/skills/loader.ts`](https://github.com/dahabit/adkclaw/blob/main/src/skills/loader.ts) — the path-traversal whitelist
- Read [`workspace.example/skills/`](https://github.com/dahabit/adkclaw/tree/main/workspace.example/skills) — every skill we ship as a reference
- Read Anthropic's [Agent Skills spec](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview) — converge formats so a skill works on multiple agents

---

## "If a student asks X..."

Quick reference for instructors during Q&A.

| Question | Point them to | One-liner |
|----------|---------------|-----------|
| "Should I use a vector DB?" | `docs/technical-decisions.md` | "Defer until <5K entries breaks. Then swap `recall()` for Vertex Vector Search — interface stays the same." |
| "What about LangChain Memory?" | LangChain Memory docs | "Same idea, more abstractions. LangChain hides the markdown layer; we want it visible for students. Same shape underneath." |
| "Can I share my bank with another agent?" | Workspace co-mounting | "Point two daemons at the same `workspace/`. They'll see the same memory. Be careful — they share `IDENTITY.md` too." |
| "How do I migrate the bank to Firestore in L4?" | L4 Firestore adapter | "Bank stays as files in Cloud Storage; Firestore stores sessions + cron. Different storage shapes for different access patterns." |
| "What if Gemini hallucinates a fact during consolidation?" | Audit trail | "The original daily note is preserved. The bank entry is one `rm` away. Audit trail is intact." |
| "Can compaction lose context I needed?" | Preservation rules + checkpoints | "The full original is in `compaction_checkpoints`. You can restore it. The preservation rules cover most pain." |
| "Why aren't tags supported on bank entries?" | Categories provide partition | "Categories are enough at small scale. If you need richer query, add it to the body and `recall()` will grep." |
| "Can I pre-load a bank from a JSON dump?" | `bank.save()` is a public API | "Yes — write a one-shot import script. `MemoryBank.save()` is idempotent on slug." |
| "How do I cron the consolidator?" | Level 3 cron engine | "L3 introduces `cron_add`. Right now run `npm run consolidate` end-of-day yourself." |
| "What about voice memos as memory input?" | Gemini multimodal | "Add a voice channel in Part 2. Pass `inlineData` to Gemini, transcribe, append via `daily_append`." |
| "Is the bank GDPR-compliant?" | File-based audit | "Plain markdown means easy export and easy delete. `rm` is the unsubscribe button." |
| "Can two agents share skills?" | Skill files are version-controlled markdown | "Yes — push the `workspace/skills/` folder to a git repo, share the URL, both agents pull from it." |

---

## Cohort fleet view

After completing L2, students light up the **second pillar** on the fleet:
**[adkclaw.dev/e/<event>/fleet](https://adkclaw.dev/e/sandbox/fleet)**

The L2 badge unlocks when (1) the agent has at least one bank entry AND (2) at least one compaction has run in the same session. Students who complete fastest see their second pillar light first — a soft motivator.

---

## Privacy + ethics notes for instructors

- Bank entries are durable. Tell students: anything they tell their agent is on disk, in plain markdown, in their own `workspace/`. Easy to inspect, easy to delete, easy to export.
- The consolidator sends raw daily notes to Gemini. Tell students to not put PII or secrets in `daily_append` calls — same hygiene as their git history.
- Skills are loaded by trust. A malicious markdown file dropped into `workspace/skills/` can guide the agent to misbehave (it's still gated by the tool registry, but it can chain tool calls in surprising ways). Treat `workspace/skills/` like `~/.bashrc` — yours alone.
- The `web_fetch` tool fetches **untrusted content**. We add `EXTERNAL_UNTRUSTED` markers in L3 — preview now if a student asks.

---

## Where to put feedback

- Open an issue: [github.com/dahabit/adkclaw/issues](https://github.com/dahabit/adkclaw/issues) with the label `level-2`
- Or DM Ahmed: [@dahabdev on X](https://x.com/dahabdev)
