# Level 0 — Instructor Guide

**Audience**: Ahmed delivering live, AND any future MENA Dev team trainer who has been certified to teach AdkClaw.

This guide pairs with `level_0/codelab.md` (the student-facing material). Read both before delivering.

---

## 1. Cohort prep checklist (T-7 days, then T-1 day)

### T-7 days
- [ ] Confirm cohort size and channel mix (online / on-site / hybrid)
- [ ] Send students the prereq sheet — 4 items (GCP project, Gemini key, TG bot, TG numeric ID)
- [ ] Send the link to `adkclaw.dev/preflight` — they validate format before joining
- [ ] If cohort > 10: file Imagen quota increase request (only matters if Part 2 runs voice-tutor demo)
- [ ] Verify your **intro demo** agent is healthy (test with a known prompt)
- [ ] Re-record the 90-second backup video if your demo agent has changed since last record
- [ ] Tag the public repo at the snapshot you're teaching against (`git tag cohort-N-start`)
- [ ] Push fresh `INSTRUCTOR_TOKEN` to Secret Manager
- [ ] Confirm Firestore event row exists with `isPublic: true` for sandbox or `false` for private

### T-1 day
- [ ] Open the slide deck (when we build slides together — for now, this codelab + diagrams suffice)
- [ ] Test the live intro demo end-to-end on the connection you'll use for the workshop
- [ ] Queue the backup recording — make sure it autoplays on a single click
- [ ] Confirm Discord/Slack channel is live and the cohort has joined
- [ ] Test screen-sharing on the chosen platform (Zoom / Meet / Hangouts)
- [ ] Confirm a TA is available to monitor chat during your live walk-through

### Day-of (T-30 min)
- [ ] Open the cohort fleet page: `adkclaw.dev/e/<event>/fleet`
- [ ] Open Cloud Shell in a separate tab — clean state
- [ ] Open `codelab/starter/` in your editor side-by-side with the slide deck
- [ ] Hit `npm run dev` in starter — confirm `🤖 AdkClaw scaffold v0` prints
- [ ] Pre-load the intro demo URL in a separate browser tab
- [ ] Take 10 deep breaths

---

## 2. Session run-of-show

L0 is a **presentation session, not a build session.** No live coding. Your job is to set the bar and the mental model. ~60 minutes total.

| Block | Slide / chapter | What you do |
|-------|-----------------|-------------|
| **Hook (5 min)** | Slide 2 — "A chatbot answers. An agent acts." | Open with the **intro demo**. Don't pre-introduce yourself. Just show. |
| **Definition (12 min)** | Slides 3–5 (rung evolution) | Walk the 5-rung table. Name a real product on each rung. Land on rung 5 = today's target. |
| **Six pillars (16 min)** | Slides 6–13 — codelab Chapter 2 | One slide per pillar. Stay 90 seconds per pillar. **Do NOT live-tour the code yet** — that's later. |
| **Tech stack (7 min)** | Slides 14–16 — codelab Chapter 3 | Direct: "the brain is Google, the plumbing is open source." Mention what we don't use and why. |
| **Repo tour (15 min)** | Slides 17–20 — codelab Chapter 4 | **Live walk** through `codelab/starter/` in your editor. Map each folder to a pillar. |
| **The journey (5 min)** | Slide 21 — codelab Chapter 5 | Preview Levels 1–4. Land on the cohort fleet view ("you'll show up here when L1 lights up"). |
| **Setup check (10 min)** | Slide 22 — codelab Chapters 6–7 | Walk students through `npm install`, `npm run setup`, `npx adkclaw check`. Wait for green ticks. |
| **Q&A (5 min)** | Slide 23 — closer | Take questions. Use the FAQ below for fast answers. |

If the cohort gets through setup quickly, end early — don't fill time. If they're stuck on setup, run over (it's the most common cohort 1 issue).

---

## 3. Demo script — the intro demo (your superpower)

The single most important moment of the session. **Open with this. Anchor everything else around it.**

### The setup
- A separate browser tab open to your deployed Coder agent (or local fallback)
- A second tab ready with your backup recording (queued, ready to play)

### The script

> **Say:** "Before we name the parts, let me show you what we're building."

Type into the agent (live):
```
build me a calculator app in Flutter
```

> **Say:** *(while it's generating)* "I'm not a Flutter expert. I'm a Google Developer Expert in Flutter and Dart, sure — but the agent is doing the typing right now. I'm just describing what I want."

When the preview loads:
> **Say:** "That's a working app. It compiled. It runs. The agent wrote it in 30 seconds."

Type:
```
make the buttons larger and add a history of past calculations
```

While it's generating, transition:
> **Say:** "What you're about to learn over the next four levels is **how this works.** Not magic. Not a wrapper around ChatGPT. Six concrete pieces, in TypeScript, in 8000 lines of code you'll understand line by line. Let's start."

Switch to Slide 2.

### If the live demo fails

Switch to the **backup recording** within 10 seconds. Don't apologize. Don't troubleshoot live.

> **Say:** "Recorded yesterday — same agent, same prompts, same outcome. Skipping the live version because we have a lot to cover."

Continue as if planned.

### If a student asks "can I get access to that demo agent?"

> **Say:** "Today we focus on building yours, not using mine. By the end of Level 4, you'll have your own deployed agent — same shape, same capabilities. By Part 2 (after Cohort 1 feedback), we'll have a Coder track that builds exactly this."

---

## 4. Common pitfalls (what students hit)

### Pitfall 1: "What does autonomous mean?"
Most students conflate **chatbot with memory** and **autonomous agent**.

**Fix**: walk back to the 5-rung table. Name where ChatGPT, Cursor, and AdkClaw live. Make the rung gap visible.

### Pitfall 2: "Why TypeScript not Python?"
Asked every cohort.

**Fix**: 30-second answer: "Both are first-class for ADK. AdkClaw is JS/TS-leaning because most web devs land here naturally. The patterns are identical — if you ever want a Python version, the BRD has the equivalents."

### Pitfall 3: "Why no LangChain?"
Often asked by students who tried agents before.

**Fix**: "LangChain hides the loop. The loop is 30 lines. We teach the loop. After this course you'll understand LangChain better, not the other way around."

### Pitfall 4: setup wizard hangs on `npm run setup`
Usually a stale `node_modules`.

**Fix**: `rm -rf node_modules package-lock.json && npm install`. If still hanging, check Node version (must be 22+, **NOT** 20 — 20 has different ESM resolution).

### Pitfall 5: "I don't know my Telegram numeric ID"
Common — they assume username.

**Fix**: Send `/start` to their bot. The bot replies with the numeric ID. (The wizard suggests this; some students miss the step.) Or use [@userinfobot](https://t.me/userinfobot).

### Pitfall 6: `npx adkclaw check` fails on `data/` not writable
Permission issue, usually on Cloud Shell after a directory move.

**Fix**: `chmod -R u+rw codelab/starter/data/`.

### Pitfall 7: Gemini API key has wrong format
Students paste with quotes or extra whitespace.

**Fix**: re-run `npm run setup`, paste again with no quotes. The wizard auto-trims, but only if pasted into the prompt cleanly.

### Pitfall 8: "What if my agent says something offensive?"
Question about safety.

**Fix**: "Gemini has built-in safety filters. The `permission` field on tools is your second guardrail — `ask` tier means the human approves before any destructive action. Level 3 covers more nuanced safety patterns."

---

## 5. FAQ

### About the course
| Question | Answer |
|----------|--------|
| Can I take just Level 1 and stop? | Yes. Each level is self-contained. After L1 you have a working agent on Telegram. |
| Will my code work after the workshop ends? | Yes. Apache 2.0 license. Your `.env` keys belong to you. The reference repo is public. |
| Do I need a Google Cloud account for L1? | No. L0–L3 run on your laptop or Cloud Shell. L4 is when GCP becomes mandatory. |
| Can I use Anthropic / OpenAI instead of Gemini? | Yes, but you'll have to swap `@google/genai` calls. Out of scope for the workshop. |

### About cost
| Question | Answer |
|----------|--------|
| What does this cost me? | Under $10 across L0–L4. Your free $300 GCP credit covers everything. |
| Will I get charged after the credit ends? | Cloud Run scales to zero — your agent is free when nobody's using it. Check Cloud Billing alerts. |

### About the tech
| Question | Answer |
|----------|--------|
| Why SQLite then Firestore? | Local-first dev (SQLite), cloud-second deploy (Firestore). Same `SessionStore` interface, same tests. |
| Why Telegram, not WhatsApp first? | Telegram has the cleanest dev API. WhatsApp is in the Part 2 roadmap. |
| Why no MCP? | MCP is for tool *discovery*; this course teaches tool *authoring*. You can layer MCP on later. |
| Is this production-ready? | The patterns are. The recovery pyramid (L3) is what makes the agent reliable. Add Cloud Logging + alerts, and yes. |

### About application
| Question | Answer |
|----------|--------|
| Can I apply this to *my* idea? | Yes — that's Part 2. We pick application tracks (Coder, Researcher, Voice Tutor, Productivity, Multi-Agent) based on cohort feedback. |
| Will I learn to build a customer-support bot? | Almost. Build the Researcher track in Part 2 — same pattern, with your docs indexed. |
| What about voice agents? | Voice Tutor track in Part 2 — uses Gemini Live API. |

### About this cohort
| Question | Answer |
|----------|--------|
| Is this recorded? | Yes. We share the recording with the cohort within 24 hours. |
| Can I skip ahead? | Each level has its own snapshot — you can clone the snapshot at the level you care about and start there. |
| What if I miss a level? | Watch the recording, do the codelab solo, rejoin the next level. |

---

## 6. Recovery scripts — when things break live

### Your Wi-Fi drops mid-demo
1. Switch to phone hotspot (have it ready)
2. While reconnecting, talk through the slide content
3. If reconnection > 60 seconds, switch to backup recording for the demo

### The intro demo agent is down
1. Switch to backup recording within 10 seconds
2. Don't apologize — just say "Recorded yesterday for the long version, skipping the live demo"
3. Continue normal flow

### Half the cohort can't run `npm install`
Likely Node version mismatch.

```bash
# Have students paste this in chat:
nvm install 22 && nvm use 22 && npm install
```

If `nvm` isn't installed, send the `nvm-sh/nvm` install line. Don't troubleshoot Node 20-vs-22 issues live — too many edge cases.

### Cloud Shell session times out for someone
Tell them: "Open a new tab, your home directory is preserved." If they lost progress, point them to `git checkout snapshot-N` in the public repo.

### A student asks something off-topic
Examples: "What about LangGraph?" / "Should I use OpenAI?" / "What about local LLMs?"

**Fix**: "Great question — that's outside today's scope. Drop it in `#questions-after` channel and I'll answer there or in the next office hours."

### A student keeps interrupting with corrections
Don't argue live. After session ends, DM them politely:
> "Thanks for the points — let's chat after the cohort. Some of what you raised is in `BRD.md`, some are good additions. Want to send them as a PR?"

---

## 7. Timing notes (real-world pacing)

| Block | Planned | Actual range (cohorts 1–N) | Adjust |
|-------|---------|---------------------------|--------|
| Hook + intro demo | 5 min | 4–8 min | Cap at 8; demo can drift if you take questions during it |
| Six pillars | 16 min | 14–22 min | Pillar 2 (Tools) and Pillar 5 (Self-healing) tend to drift; tighten with timer |
| Tech stack | 7 min | 5–10 min | "Why no LangChain?" derails — bake the answer into the slide |
| Repo tour | 15 min | 12–25 min | Biggest variance. Time-box to 15 min. |
| Setup check | 10 min | 8–25 min | If most are stuck, take a 5-min break, debug in chat, resume. |
| Q&A | 5 min | 5–15 min | If sessions ran long, skip and move questions to chat |

If you're 15 minutes behind by the repo tour, **cut Slides 14–16 (tech stack)** and reference them in the codelab instead. Students can read them async.

---

## 8. Train-the-trainer notes

If you're teaching this for the first time (i.e., Ahmed has certified you), pay extra attention to:

### Load-bearing concepts (do not skip)
1. **The 5-rung evolution** — without this, students don't understand why the rest of the course is different.
2. **Tool descriptions are the LLM's only signal** — sets up Level 1 expectations.
3. **The brand promise: the agent never crashes** — students need to hear this is a *design constraint*, not a feature.

### Concepts that can be summarized
- Why TypeScript (30 seconds is enough)
- Why no LangChain (one sentence)
- Workspace files are data not code (one slide, no deep dive)

### Concepts that always run long
- Pillar 5 (Self-healing) — the recovery pyramid is where students get visibly excited. Plan for it.
- The repo tour — students always have folder-naming questions. Pre-empt with "you'll see why we structured it this way in Level N".

### What you absolutely must NOT do
- ❌ Live-code in Level 0. This is the orientation. Level 1 is where code starts.
- ❌ Skip the intro demo. It's the single most powerful pedagogical moment of the session.
- ❌ Pretend to know answers you don't. "I don't know — let me find out and post in the channel" is fine.
- ❌ Defend choices defensively. State them confidently and move on. ("We picked SQLite because Postgres is overkill for a single-host agent." Period.)

### How to certify

You're ready to teach Level 0 when you can:
1. Run the intro demo from memory (no notes)
2. Recite the six pillars in order, in 30 seconds, with one folder reference per pillar
3. Answer the top 5 FAQ questions without checking this guide
4. Walk the repo tour in 12 minutes flat with the timer running

Ahmed certifies via a 30-minute mock-teach over Zoom. Approval = green light to teach a real cohort.

---

## Where to update this guide after each cohort

Keep this guide alive. After each cohort:
- [ ] Add any new pitfall students hit to Section 4
- [ ] Add any new question to the FAQ if it came up >1 time
- [ ] Update timing variance numbers in Section 7
- [ ] Note any slides that landed flat or great in `level_0/INSTRUCTOR-LOG.md` (we'll create when first cohort runs)

This is a living document. The first version (v1) is what you're reading now. After Cohort 1, expect a v2.
