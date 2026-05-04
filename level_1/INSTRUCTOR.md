# Level 1 — Instructor Guide

**Audience**: Ahmed delivering live, AND any future MENA Dev team trainer who has been certified to teach AdkClaw.

This guide pairs with `level_1/codelab.md`. Read both before delivering.

---

## 1. Cohort prep checklist (T-7 days, then day-of)

### T-7 days
- [ ] Confirm L0 was completed by all students (or sandbox-cleared via fleet view)
- [ ] Verify `codelab/starter/` builds clean on a fresh clone (`npm install` + `npm run typecheck`)
- [ ] Ensure each student has the 4 prereqs (GCP project, Gemini key, TG bot, TG numeric ID)
- [ ] Test the L1 demo flow yourself end-to-end with a fresh agent name (not `Dudu` — pick one for this cohort)
- [ ] Pre-record the L1 backup demo video (5–10 min — full agent loop + 3 tools + Telegram)

### Day-of (T-30 min)
- [ ] Open `codelab/starter/` in your editor, fresh clone
- [ ] Have 6 empty terminal tabs ready (one per chapter step)
- [ ] Pre-stage your `.env` with valid keys (so you don't fumble the wizard live)
- [ ] Open `adkclaw.dev/e/<event>/fleet` to watch L1 badges light up

---

## 2. Session run-of-show

L1 is the first **build session.** ~2 hours total. Heavy on live coding.

| Block | Chapter | What you do |
|-------|---------|-------------|
| Re-intro (5 min) | none | "Yesterday we mapped the territory. Today we build the brain." Recap the 6 pillars in 60 seconds. |
| Scaffold (5 min) | Ch. 1 | Show the starter is a clean canvas. Run `npm install` in your tab while talking. |
| First Gemini call (10 min) | Ch. 2 | Live-write `src/index.ts` minimal version. Run it. Land the "this is NOT an agent" point. |
| The agent loop (25 min) | Ch. 3 | The conceptual peak. Draw the diagram on a whiteboard / shared doc. Then live-write `runner.ts` and `registry.ts` slowly, narrating every line. |
| Three tools (20 min) | Ch. 4 | Live-write `web.ts` and `filesystem.ts`. Spend extra time on tool descriptions. |
| Personality (20 min) | Ch. 5 | Walk through `IDENTITY.md`, `SOUL.md`, `agent.yaml`. Demonstrate editing `SOUL.md` and seeing the agent's voice change. |
| Telegram + sessions (25 min) | Ch. 6 | Live-write `sessions/store.ts`, `channels/telegram.ts`, `server/http.ts`, full `index.ts`. Run it. Demo on your phone. |
| Live demo (10 min) | end of codelab | Take a question from the audience, type it into your bot, show the agent reasoning + tool call. |
| Q&A (5 min) | recap | Take questions. Use FAQ below. |

If running short, condense Ch. 4 (tools) — `web_fetch` is largely the same as `web_search`. Don't condense Ch. 3 — the loop is load-bearing.

---

## 3. Demo script — the L1 reveal

The first **wow moment** of the workshop. Set it up carefully.

### Setup
- Daemon running locally
- Phone with Telegram open, your bot loaded
- Mirroring your phone screen to the room (or screenshare if online)

### The script

> **Say:** "I am going to put my agent in my pocket. From the room. Watch."

Send `/start` from your phone. Bot replies with numeric ID.
> **Say:** "That is the agent saying hi. Notice the bot just told me my own ID — that is the self-service onboarding pattern. No registration form, no sign-up flow."

Add ID to `.env`, restart daemon.

Send: `Hi, I am Ahmed. Can I name you Dudu?`
> **Say:** *(while waiting)* "I just edited `SOUL.md` to allow the agent to embrace nicknames. Watch."

When reply lands:
> **Say:** "Dudu. The agent did not say 'I prefer to be called my configured name.' It said 'Dudu it is.' That is the difference between corporate AI and a teammate."

Send: `What is the latest version of Flutter?`
> **Say:** "This will trigger `web_search`. Watch the logs."

Show the terminal — the function call appears. The reply lands with cited result.
> **Say:** "Two tool descriptions, three tools registered, one loop, fifty lines of TypeScript — and I have an agent that knows it does not know Flutter's version, knows Google Search exists, and knows when to call it."

Switch to slide 18 (closing): "Tomorrow: it remembers across reboots."

### If the live demo fails

- Switch to backup recording within 10 seconds
- Don't apologize. "Recorded earlier — same flow. Skipping the live version."
- Continue normally

---

## 4. Common pitfalls (what students hit)

### Pitfall 1: `ERR_MODULE_NOT_FOUND` — forgot `.js` extension
The `tsconfig.json` `"moduleResolution": "NodeNext"` requires `.js` even when importing `.ts` source.

**Fix**: walk the import — `import { ... } from './runner.js'`. Wrong: `from './runner'` or `from './runner.ts'`.

### Pitfall 2: `ALLOWED_SENDERS=@dahabdev` (username instead of numeric ID)
Looks right, silently rejects every message. The new `validateConfig()` warns about this.

**Fix**: `ALLOWED_SENDERS` takes numeric IDs only. Send `/start` to get yours.

### Pitfall 3: Tool description is too vague
"Run commands" is what students always write first. The agent then tries to use it for everything.

**Fix**: live-rewrite the description with the student. Get specific about input shape, output shape, and when to call it.

### Pitfall 4: Forgot to append `functionResponse` after `functionCall`
The model hallucinates a result on the next round.

**Fix**: trace through the history array slowly. Show the role-flip pattern: `model` (with functionCall part) → `user` (with functionResponse part) → `model` (with text or another functionCall).

### Pitfall 5: Daemon needs restart after editing `.env`
Workspace files reload via mtime. `.env` only loads at boot.

**Fix**: tell students once, repeat when they hit it. Add a startup banner in your version that prints `[boot] env loaded from .env`.

### Pitfall 6: `MAX_TOOL_ROUNDS=15` hit
Means the agent is stuck in a tool loop — usually a bad description making the LLM call the same tool repeatedly.

**Fix**: show the logs. Identify the misbehaving description. Rewrite it.

### Pitfall 7: Telegram bot already in use
Student created multiple bots, the first one is still polling, two bots fight.

**Fix**: revoke old bot via BotFather, generate fresh token, paste into `.env`, restart.

### Pitfall 8: SQLite write fails — `data/` not writable
Permission issue, especially in Cloud Shell after directory moves.

**Fix**: `chmod -R u+rw codelab/starter/data/`.

---

## 5. FAQ

### About the loop
| Question | Answer |
|----------|--------|
| Why a `for` loop and not `while`? | `for` makes the round cap (`MAX_TOOL_ROUNDS=15`) explicit. `while` would need a separate counter. |
| What if the LLM emits text AND a tool call? | Gemini does not currently. If it ever does, treat the text as filler and process the tool call. |
| Can the same tool be called twice in one round? | Yes — `response.functionCalls` is an array. Run them all, append all responses. |

### About tools
| Question | Answer |
|----------|--------|
| Why is `web_search` in the example a stub? | The full version uses Gemini's grounding API which requires extra config. The stub keeps Chapter 4 focused on the registration pattern. Production version is in `src/tools/web-search.ts`. |
| What about MCP? | MCP is for tool *discovery*. We teach tool *authoring*. You can add MCP after L4. |
| Can I add 50 tools? | You can. The model gets confused past ~20. Sub-agents (L3) are how you scale tool count. |

### About personality
| Question | Answer |
|----------|--------|
| Does the agent really read all those files every turn? | Yes, but cached by mtime. First read is ~5ms; cached reads are zero cost. |
| What if the system prompt gets too long? | Cap `MEMORY.md` at 20K tokens. Long-term storage goes in `bank/` (Level 2). |
| Can `IDENTITY.md` change mid-conversation? | Yes — edit the file, the next turn picks it up. |

### About sessions
| Question | Answer |
|----------|--------|
| Why SQLite, not Postgres? | A single-host agent does not need a separate DB process. SQLite is faster for this workload. |
| Will I lose history when I switch to Firestore in L4? | The `SessionStore` interface is identical. The Firestore adapter passes the same tests. |
| Can two users share a session? | Different sessions because keys differ (`<channel>:<senderId>`). They share the same `workspace/` (and so the same memory bank in L2). |

### About Telegram
| Question | Answer |
|----------|--------|
| Why is Telegram first, not WhatsApp? | Telegram has the cleanest dev API — no per-message template approval. WhatsApp Cloud API arrives in a Part 2 stretch level. |
| Can I add Discord / Slack? | Yes. The pattern is `MessageNormalizer` → call `runner.run()` → reply. Same shape as Telegram. |
| What about voice notes? | Gemini Live API in Part 2's Voice Tutor track. |

---

## 6. Recovery scripts — when things break live

### Half the cohort fails `npm install`
Likely Node version mismatch.

```bash
# Have students paste this in chat:
nvm install 22 && nvm use 22 && rm -rf node_modules package-lock.json && npm install
```

### Gemini quota hit during live demo
Switch to Flash via env:
```bash
DEFAULT_MODEL=gemini-2.5-flash npm run dev
```
Re-explain why fallback exists (a teaching moment, not an emergency).

### Telegram bot returns 401 / 403
Token revoked or copy-paste error.

**Fix**: regenerate token via BotFather, replace in `.env`, restart.

### A student's agent never responds
Probable causes (in order):
1. `ALLOWED_SENDERS` empty or wrong (most common)
2. Bot token wrong
3. `npm run dev` not actually running
4. Wrong Gemini API key

Have them paste their `npx adkclaw check` output in chat.

### "My computer is too slow"
Cloud Shell branch. Have them run the same code there. Cloud Shell normalizes hardware.

---

## 7. Timing notes (real-world pacing)

| Block | Planned | Cohort 1 actual range | Adjust |
|-------|---------|----------------------|--------|
| Re-intro | 5 min | 3–8 min | Cap at 8; do not re-teach L0 |
| Scaffold (Ch. 1) | 5 min | 4–10 min | If `npm install` is slow, talk through concepts |
| First Gemini call (Ch. 2) | 10 min | 8–15 min | Quick; no major branches |
| Agent loop (Ch. 3) | 25 min | 25–40 min | Biggest variance. Take your time. |
| Three tools (Ch. 4) | 20 min | 15–30 min | Tool descriptions take longer than expected. |
| Personality (Ch. 5) | 20 min | 15–25 min | The "wow" moment lands here; pacing recovers. |
| Telegram + sessions (Ch. 6) | 25 min | 25–40 min | The wiring step. Lots of files. |
| Demo + Q&A | 15 min | 10–25 min | Skip if running long; move questions to chat |

If you are 30 minutes behind by Ch. 6, **skip the CLI REPL test** at the end of Ch. 6. Telegram alone is enough proof. Students can do the REPL on their own.

---

## 8. Train-the-trainer notes

### Load-bearing concepts (do not skip)
1. **The agent loop is a `for` loop** — students should not see "magic" anywhere.
2. **Tool descriptions are the LLM's only signal** — have them rewrite at least one description live.
3. **Workspace files reload via mtime** — demonstrates "personality is data, not code."
4. **`/start` self-service ID pattern** — best onboarding pattern in the course.

### Concepts that can be summarized
- Why TypeScript + ESM (~30 seconds)
- Why SQLite over Postgres (~30 seconds)
- Why telegraf over raw Bot API (~15 seconds)

### Concepts that always run long
- The agent loop (Ch. 3) — students need to see it twice. Plan 30–35 min, not 25.
- Tool descriptions (Ch. 4) — first instinct is bad descriptions; coaching takes time.
- Telegram allowlist (Ch. 6) — students always paste username instead of numeric ID at least once.

### What you absolutely must NOT do
- ❌ Skip writing the runner.ts loop. Students must see this from blank file.
- ❌ Use a pre-written codelab/snapshot-1 as the starting point — defeats the build.
- ❌ Rush Chapter 5 (personality). The "wow" moment lands here; protect it.
- ❌ Show LangChain comparisons mid-build. Save for Q&A if asked.

### How to certify

You are ready to teach Level 1 when you can:
1. Live-write `runner.ts` from blank file in 12 minutes flat
2. Recite the pitfalls in order, with the fix
3. Run the full demo script (including failure recovery) without notes
4. Explain why tool descriptions matter without using the word "important"

Ahmed certifies via a 60-minute mock-teach over Zoom — you teach Level 1 to him, he plays a confused student.

---

## Where to update this guide after each cohort

After each cohort:
- [ ] Add new pitfalls to Section 4
- [ ] Add new questions to FAQ if asked >1 time
- [ ] Update timing variance numbers
- [ ] Note slides that landed flat or great in `level_1/INSTRUCTOR-LOG.md`
