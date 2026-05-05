# Level 2 — Instructor Guide

**Audience**: Ahmed delivering live, AND any future MENA Dev team trainer who has been certified to teach AdkClaw.

This guide pairs with `level_2/codelab.md`. Read both before delivering.

---

## 1. Cohort prep checklist (T-7 days, then day-of)

### T-7 days
- [ ] Confirm L1 was completed by all students (or sandbox-cleared via fleet view)
- [ ] Verify each student's L1 daemon still runs (`bin/adkclaw bg` then send a Telegram message)
- [ ] Test the L2 demo flow yourself end-to-end with a fresh agent
- [ ] Pre-record the L2 backup demo video (5–8 min — restart-survives-memory + skill self-creation)
- [ ] Pre-stage three workspace skill files you'll show: `research-topic.md`, `remember-decisions.md`, `consolidate-now.md`
- [ ] Verify the consolidator works on Flash — Gemini occasionally degrades JSON fidelity on small models

### Day-of (T-30 min)
- [ ] Open the L1 codebase in your editor; clean working tree
- [ ] Have 5 empty terminal tabs ready (one per chapter)
- [ ] Pre-stage your `.env` (same as L1, no new keys)
- [ ] Open `adkclaw.dev/e/<event>/fleet` to watch L2 badges light up
- [ ] Have a long Telegram conversation pre-loaded so compaction can trigger live (50+ turns)

---

## 2. Session run-of-show

L2 is the **memory and skills session.** ~2 hours total. Heavy on architectural reasoning, lighter on raw typing than L1.

| Block | Chapter | What you do |
|-------|---------|-------------|
| Re-intro (5 min) | none | "Yesterday we built a brain. Today it stops being amnesiac." Recap the three-tier memory model in 60 seconds. |
| Branch + verify (5 min) | Ch. 1 | `git checkout -b level-2`. Run L1 tests to prove the baseline. |
| Context engine (25 min) | Ch. 2 | Whiteboard the read order. Live-write `manager.ts`. Demo: edit `USER.md` mid-conversation; agent picks up the change next turn. |
| Compaction (20 min) | Ch. 3 | The why-summarize-oldest moment. Live-write `compaction.ts`. Walk the preservation rules slowly. |
| Memory bank (25 min) | Ch. 4 | Why structured beats vector at small scale. Live-write `bank.ts`. Wire `memory_save` and `memory_recall`. |
| Daily notes + consolidator (20 min) | Ch. 5 | "Raw memory promotes overnight." Live-write `daily-notes.ts` and `consolidator.ts`. Run a consolidation. |
| Skills (15 min) | Ch. 6 | The self-learning moment. Drop a skill file; restart; agent advertises it. |
| Wow demo (10 min) | Ch. 7 | The triple demo: restart-survives-memory, skill-from-markdown, compaction-in-logs. |
| Q&A (5 min) | recap | Take questions. Use FAQ below. |

If running short, condense Ch. 5 (consolidator) — students can run it on their own. Don't condense Ch. 2 (context engine) — it's load-bearing for everything else.

---

## 3. Demo script — the L2 reveal

Three back-to-back demos. The cumulative effect is the wow.

### Setup
- Daemon running locally
- Phone with Telegram open, your bot loaded
- Mirroring your phone screen to the room (or screenshare if online)
- Three pre-staged skill files in a tab — paste-ready

### Demo 1 — survives a restart

> **Say:** "Right now my agent is amnesiac across reboots. Watch."

Send: `Remember I prefer SQLite over Postgres for v1 projects.`

Agent replies, saves to the bank.

> **Say:** "Now I'm going to kill the daemon."

```bash
bin/adkclaw stop
```

> **Say:** "And restart it."

```bash
bin/adkclaw bg
```

Send: `What database do I prefer for v1?`

Agent replies with SQLite + the bank entry path.

> **Say:** "It read the answer off disk. The conversation history is gone — only the structured memory survived. That's the whole point."

### Demo 2 — gains a skill from a markdown file

> **Say:** "I've never taught my agent how to research a topic. Watch."

Send: `Research the latest Vertex AI Vector Search pricing.`

Agent fumbles — calls `web_search` once, gives a thin answer.

> **Say:** "Now watch."

Paste the `research-topic.md` skill file into `workspace/skills/`. Restart the daemon.

Send the same prompt. Agent now follows the procedure: 5 web searches, 3 fetches, structured brief.

> **Say:** "I taught my agent a procedure with a markdown file. No deploy. No code. The procedure is version-controlled, shareable, and reversible. Personality is data, behaviour is data, memory is data — that's the whole curriculum in one sentence."

### Demo 3 — compaction in action

Open a terminal tab tailing the daemon logs.

Have a pre-loaded long conversation (you set this up before the workshop — 50+ turns of you-vs-bot in your Telegram).

Send a fresh message that pushes the active history past the threshold.

Watch the log line:

```
[compaction] tokensBefore=820000 oldest=30 summary=18kb tokensAfter=210000
```

> **Say:** "It just summarised the oldest 60% of the conversation, kept everything that mattered, and freed 600k tokens. Without it, the model starts losing the plot at 1M. With it, my agent can hold a year of conversation."

### If the live demo fails

- Switch to backup recording within 10 seconds
- Don't apologise. "Recorded earlier — same flow. Skipping the live version."
- Continue normally

---

## 4. Common pitfalls (what students hit)

### Pitfall 1: ContextEngine cache never invalidates
The `fingerprint()` is missing one of the files in its scan. Most commonly the daily note or the skills directory.

**Fix**: walk the fingerprint, ensure each file in the read order is also in the fingerprint scan. Edit a file with `touch` and confirm bootstrap rebuilds.

### Pitfall 2: Compaction summarises the WRONG side of history
Students sometimes summarise the **last** N messages instead of the oldest.

**Fix**: re-explain — recent messages are what the agent needs **right now**. We summarise the oldest. Walk through the slice math on a whiteboard.

### Pitfall 3: Consolidator returns `parsed = {}`
Gemini wrapped the JSON in markdown fences. The strict `JSON.parse()` fails.

**Fix**: show `parseJsonLoose()` — strip ```json fences, then fall back to extracting the first `{...}` block. Add a test that uses fenced output.

### Pitfall 4: MemoryBank `save()` overwrites silently
Two facts with similar names slugify to the same path.

**Fix**: that's by design — it's idempotent on slug. If students need version history, point them at git. Mention `read()` returns the existing entry's `createdAt` so timestamps survive overwrites.

### Pitfall 5: Skills directory traversal
Student writes `await loader.load('../../etc/passwd')`.

**Fix**: show the `replace(/[^a-zA-Z0-9._-]/g, '')` line. Path-traversal blocked by character whitelist.

### Pitfall 6: `daily_append` writes UTC timestamps when student is in GMT+3
Students complain that their notes have wrong times.

**Fix**: set `TZ=Africa/Cairo` (or whatever) in `.env` before starting the daemon. Daemon process inherits it.

### Pitfall 7: System prompt growing past 100KB
Bank index dumped the full content of every entry instead of just titles.

**Fix**: the bank index in `bootstrap()` should list `name + preview` per entry, not the full body. The body is fetched on demand via `memory_recall`.

### Pitfall 8: Compaction loop — keeps re-compacting on every turn
The `lastCompactionAt` checkpoint isn't being saved or read.

**Fix**: verify `compaction_checkpoints` row is inserted after each summarisation and the threshold check uses `tokens since last checkpoint`, not `tokens total`.

---

## 5. FAQ

### About memory architecture
| Question | Answer |
|----------|--------|
| Why three tiers and not just one big bank? | Different decay times. In-context dies in a turn. Daily dies in a day. Bank lives forever. Each tier matches a use case. |
| Why not use embeddings + vector search? | At our scale (<5K entries), grep beats vectors on relevance. Defer the complexity until simple breaks. |
| Can I add a fifth category? | Yes. Edit `BANK_CATEGORIES`, add a folder, update the consolidator prompt. Ship a PR if it's general (e.g. `goals`). |
| When does the consolidator run in production? | End-of-day cron in L3. For L2 students, manual trigger via `npm run consolidate`. |

### About compaction
| Question | Answer |
|----------|--------|
| Why summarise the oldest, not the smallest-importance? | Recency is the cheapest, most reliable signal of relevance. Importance scoring would need another LLM call. |
| Why Flash for the summary call? | 10x cheaper. Summarisation is structural, not user-facing. Quality difference is negligible at this task. |
| What if the summary loses something I needed? | The full original is in `compaction_checkpoints`. You can restore it. |
| Can I disable compaction? | Yes — set `thresholdTokens: Number.MAX_SAFE_INTEGER`. Not recommended past ~30 turns of heavy tool use. |

### About skills
| Question | Answer |
|----------|--------|
| How is a skill different from a tool? | A tool is a function. A skill is a procedure that often calls multiple tools. Skills are markdown; tools are TypeScript. |
| Can a skill call another skill? | Yes — the body just lists `load_skill('other-skill')` as a step. |
| What about Anthropic's "Agent Skills" — same idea? | Same idea, different format. Ours uses YAML frontmatter; theirs uses a structured JSON spec. Convertible. |
| Why advertise only `description + when_to_invoke` in the system prompt, not the body? | Token economy. The body is fetched on demand. The agent doesn't need procedural detail until it commits. |

### About the consolidator
| Question | Answer |
|----------|--------|
| What if Gemini hallucinates a fact during consolidation? | The original daily note is preserved. The bank entry can be deleted (`rm` the file). Audit trail intact. |
| Can the user override the consolidator? | Yes — `memory_save` is exposed as a tool. Tell the agent: "Save X as a fact" — direct write. |
| How long should daily notes get before they're too long? | Soft cap at 50KB. Past that, consolidate sooner. The cron in L3 will run twice a day if the day is busy. |

### About workspace files
| Question | Answer |
|----------|--------|
| Can a workspace be shared between agents? | Yes — point two daemons at the same `workspace/`. They'll see the same memory. They share `IDENTITY.md` though, so they think they're the same agent. |
| What about per-user workspace? | Use `workspace/users/<senderId>/` and have `ContextEngine` route by `senderId`. We don't ship this in L2 — it's a Part 2 feature. |

---

## 6. Recovery scripts — when things break live

### Half the cohort's compaction never triggers
Token counter approximation is off. A turn that should be 2k tokens reads as 200.

```bash
# Have students paste this:
node -e "import('./dist/context/token-counter.js').then(m => console.log(m.estimateTokensInString('hello world')))"
```

Should print ~3. If it prints 0, the counter is broken — point them at `src/context/token-counter.ts`.

### Bank entries don't appear in recall
The `ContextEngine` cached past the bank changes.

**Fix**: confirm the fingerprint includes `bank/` mtimes. Rebuild with `touch` on a bank entry to force invalidation.

### Consolidator returns `parsed = {}`
Gemini wrapped JSON in markdown fences.

**Fix**: copy-paste the output, run through `parseJsonLoose()` in a REPL. Show students it strips the fences.

### Telegram bot times out during compaction
Compaction running synchronously on the chat path. ~3-5 second pause.

**Fix**: wrap in `Promise.race([compaction, timeout(2000)])` and skip if it doesn't finish in time. Production code does this — point students at the runner integration.

### A student's daemon crashed mid-consolidation, half-written file
Idempotency saves you. Re-run `npm run consolidate -- --date=YYYY-MM-DD`. The bank `save()` overwrites cleanly.

---

## 7. Timing notes (real-world pacing)

| Block | Planned | Cohort 1 actual range | Adjust |
|-------|---------|----------------------|--------|
| Re-intro | 5 min | 3–8 min | Cap at 8; do not re-teach L1 |
| Branch + verify (Ch. 1) | 5 min | 5–10 min | If tests fail, that's an L1 issue — pair-debug in chat, don't block the cohort |
| Context engine (Ch. 2) | 25 min | 20–35 min | The "edit a file mid-conversation" demo always lands well — protect the time |
| Compaction (Ch. 3) | 20 min | 18–30 min | Preservation rules walkthrough takes longer than expected |
| Memory bank (Ch. 4) | 25 min | 22–35 min | The four-categories debate eats ~5 min; that's fine — it's load-bearing |
| Daily + consolidator (Ch. 5) | 20 min | 15–25 min | If short on time, demo the consolidator instead of having students implement |
| Skills (Ch. 6) | 15 min | 12–20 min | The self-learning loop is a 90-second demo — don't over-explain |
| Wow demo + Q&A | 15 min | 10–25 min | Skip Demo 3 (compaction) if running long; the first two carry the level |

If you are 30 minutes behind by Ch. 5, **demo the consolidator** instead of having students implement it. The pattern is clear from the codelab.

---

## 8. Train-the-trainer notes

### Load-bearing concepts (do not skip)
1. **The mtime fingerprint cache** — this is what makes "edit a file → next turn knows" work. Demo it.
2. **Compaction preserves the oldest, not the freshest** — students always get this wrong on first hearing.
3. **The consolidator is an LLM-curation step** — without curation, the bank fills with chatter. Drive this point home.
4. **A skill is markdown, a tool is TypeScript** — the distinction unlocks the self-learning loop.

### Concepts that can be summarised
- Why frontmatter on every bank entry (~30 seconds — auditability + idempotent overwrites)
- Why slug normalisation (~30 seconds — filesystem safety + deterministic dedupe)
- Why Flash for summary (~15 seconds — 10x cheaper, structural overhead)

### Concepts that always run long
- The context engine read order (Ch. 2) — students keep asking "what about X.md?" Plan 30 min, not 25.
- The four-categories debate (Ch. 4) — every cohort wants `goals` or `tasks`. Defer to a Part 2 stretch.
- The first skill file (Ch. 6) — students over-engineer it. Coach them to keep steps to 5.

### What you absolutely must NOT do
- Skip writing `manager.ts` from blank file. Students must see this from scratch.
- Use embeddings as a "modern alternative" — it's a distraction at this scale.
- Show LangChain Memory / LangGraph comparisons mid-build. Save for Q&A if asked.
- Rush the self-learning loop demo (Ch. 6). It's the cohort's "I get it now" moment.

### How to certify

You are ready to teach Level 2 when you can:
1. Live-write `ContextEngine.bootstrap()` from blank file in 10 minutes flat
2. Recite the three-tier memory model and where each tier breaks down
3. Run the full demo script (including failure recovery) without notes
4. Explain why we summarise the oldest, not the smallest, in one breath

Ahmed certifies via a 60-minute mock-teach over Zoom — you teach Level 2 to him, he plays a confused student.

---

## Where to update this guide after each cohort

After each cohort:
- [ ] Add new pitfalls to Section 4
- [ ] Add new questions to FAQ if asked >1 time
- [ ] Update timing variance numbers
- [ ] Note slides that landed flat or great in `level_2/INSTRUCTOR-LOG.md`
