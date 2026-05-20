# Workshop Development Guide

How to build, split, and maintain the four AdkClaw workshop codelabs.

## The two-pass methodology

**Pass 1 — Reference build** (already done): implement the entire system end-to-end on `main`. The reference is the answer key. Don't write codelab content until the reference works — codelabs distill real experience, not speculation.

**Pass 2 — Split into codelabs**: carve the working repo into a `starter/` + per-step snapshots. Each step is a verified-working tree that can be `npm install && npm run dev`'d independently.

This means: the reference always stays ahead of the codelabs. When you fix a bug or improve a module, you fix it in `src/` first, then propagate changes to the relevant codelab steps.

---

## Workshop map

### Workshop 1 — Evolution of AI
*Concept: chatbot → tool-using → autonomous. Give the agent a name and personality.*

| Step | What students build | Key files introduced |
|------|--------------------|--------------------|
| 1 — Scaffold | package.json, tsconfig, types | `src/types/`, `src/config/` |
| 2 — First agent | Raw Gemini call, no tools | `src/agent/runner.ts` (simplified) |
| 3 — Telegram + CLI | Channels, HTTP server | `src/channels/telegram.ts`, `src/server/http.ts`, `src/cli/repl.ts` |
| 4 — Personality | Setup wizard, workspace files | `src/cli/setup.ts`, `workspace/` |
| Solution | P0–P7 complete | All of the above |

**Learning outcomes:**
- Understand the Gemini content API (roles, parts, function calling schema)
- See how a multi-channel agent shares a single runner
- Experience the "name your agent" ceremony that makes it feel real

---

### Workshop 2 — Agent Anatomy
*Concept: short/long/semantic memory, context bootstrap, compaction.*

| Step | What students build | Key files introduced |
|------|--------------------|--------------------|
| 1 — Memory bank | `bank/` taxonomy, save + recall | `src/memory/bank.ts` |
| 2 — Context engine | Bootstrap, caching by mtime | `src/context/manager.ts`, `src/context/token-counter.ts` |
| 3 — Compaction | LLM summarization at 80% | `src/context/compaction.ts` |
| Solution | P8–P10 complete | All of the above |

**Learning outcomes:**
- Understand why context compaction is mandatory (not optional)
- See the bank taxonomy and how structured memory beats free-text recall
- Understand the mtime-fingerprint cache pattern

---

### Workshop 3 — ADK in Action
*Concept: markdown skills, web grounding, embeddings, vector search.*

| Step | What students build | Key files introduced |
|------|--------------------|--------------------|
| 1 — Skills | Skill file loader, load_skill + list_skills tools | `src/skills/loader.ts`, `src/tools/skills.ts` |
| 2 — Web grounding | web_search with Gemini grounding citations | `src/tools/web-search.ts` |
| 3 — Embeddings | Vertex AI embedding calls, bank semantic search | `src/tools/memory.ts` (enhanced) |
| Solution | P11, P18 complete | All of the above |

**Learning outcomes:**
- See how skills let the agent learn without a redeploy
- Understand the difference between grounding (live web) and semantic recall (bank)
- Get hands-on with Vertex AI embeddings

---

### Workshop 4 — Agent Army
*Concept: sub-agent profiles, A2A, self-healing, cron + heartbeat.*

| Step | What students build | Key files introduced |
|------|--------------------|--------------------|
| 1 — Sub-agent profiles | Named profiles, spawn tools | `src/multi-agent/profiles/`, `src/tools/spawn.ts` |
| 2 — Orchestrator | Isolation model, goal ancestry | `src/multi-agent/orchestrator.ts` |
| 3 — Self-healing | Error classification, retry + fallback | `src/healing/` |
| 4 — Cron + heartbeat | Scheduled jobs, HEARTBEAT.md loop | `src/cron/` |
| Solution | P12–P14 complete | All of the above |

**Learning outcomes:**
- Understand why sub-agent isolation matters (no parent context leakage)
- Experience the recovery pyramid — the agent never crashes
- Build a proactive monitoring workflow end-to-end

---

## How to create a step snapshot

Each step is a minimal working tree. Students start from the previous step and implement the delta.

```bash
# Example: create workshop-1 step-3 (Telegram + CLI)
STEP=codelab/workshop-1-evolution-of-ai/step-3-telegram

# Copy the relevant source files
rsync -a src/types/         $STEP/src/types/
rsync -a src/config/        $STEP/src/config/
rsync -a src/sessions/      $STEP/src/sessions/
rsync -a src/agent/runner.ts $STEP/src/agent/runner.ts
rsync -a src/channels/telegram.ts $STEP/src/channels/telegram.ts
rsync -a src/server/http.ts $STEP/src/server/http.ts
rsync -a src/cli/           $STEP/src/cli/
cp src/index.ts             $STEP/src/index.ts

# Copy workspace template
cp -r workspace.example/    $STEP/workspace.example/

# Stub the files students will implement this step
echo "// Implement TelegramAdapter here" > $STEP/src/channels/telegram.ts

# Verify it runs (minus the file students implement)
cd $STEP && npm install && npx tsc --noEmit
```

**Step validation checklist:**
- [ ] `npm install` succeeds
- [ ] `npx tsc --noEmit` — no type errors on the provided (non-stub) files
- [ ] `npm test` — tests for the step's scope pass
- [ ] `npm run setup && npm run dev` — daemon boots

---

## Codelab content structure

Each workshop step maps to a Google Codelab section. The codelab content (what students read) is not in this repo — it lives in the Google Codelabs authoring tool. But the structure follows this pattern:

```
Section: "Step N — <what you're building>"
  Overview (1 paragraph: what + why)
  Concept explanation (diagram or ASCII art)
  Implementation task (what to write)
  Solution diff (link to step-N vs step-N-1 diff)
  Test it (acceptance test command)
```

The diff between consecutive step snapshots IS the lesson. Keep diffs tight — one concept per step.

---

## Propagating reference fixes to codelabs

When you fix a bug in `src/`:

1. Identify which workshop step(s) contain the affected file
2. Copy the fixed file into each step: `cp src/<fixed>.ts codelab/workshop-N/step-M/src/<fixed>.ts`
3. Re-verify the step: `cd codelab/workshop-N/step-M && npm test`
4. If the fix involves a new test, add the test to the step's test suite

Keep the reference and codelabs in sync — don't let them diverge.

---

## Starter baseline

`codelab/starter/` is what students clone before Workshop 1. It should contain:

- `package.json` with all production deps listed (students run `npm install` once)
- `tsconfig.json`
- `src/index.ts` with a stub comment
- `workspace.example/` — the full template
- `.env.example` — with placeholder values
- `.gitignore`

The starter has NO implementation — just the scaffold students need to start building.

---

## Known teaching traps

These are the moments where students consistently get stuck. Document your own discoveries here.

**Workshop 1**
- Telegram message format: students forget that the Gemini API expects alternating `user/model` roles. A `user` message after a `model` message that ended with a function call needs to be a `functionResponse` part, not a text part.
- Session keys: students may use the same `sessionKey` for different users, causing context bleed.

**Workshop 2**
- Compaction timing: compaction should never fire in the middle of an agent turn. It fires at turn start after the history is loaded. Students who put compaction inside the tool execution loop will see corrupted history.
- Token counting: cl100k_base (GPT-4) tokens ≠ Gemini tokens. The estimate is ~15% off for Arabic/CJK text. Safe enough for the 80% threshold.

**Workshop 3**
- Grounding vs. tool calling: Gemini's Search Grounding (`tools: [{googleSearch: {}}]`) is different from the `web_search` function tool. Grounding injects results into the model's context automatically; function tools require explicit `functionCall` → `functionResponse` round-trips. Both are useful; students should understand the difference.

**Workshop 4**
- Sub-agent timeout: a hung sub-agent hangs the parent. Always wrap orchestrator spawns in `Promise.race` with a timeout. Students who skip this end up with parent sessions that hang indefinitely.
- Goal ancestry vs. context: `goalChain` is the *purpose* of the task; it's not the conversation history. Students sometimes try to pass the full parent history in `goalChain`, which defeats the isolation purpose.
