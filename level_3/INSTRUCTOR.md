# Level 3 — Instructor Guide

**Audience**: Ahmed delivering live, AND any future MENA Dev team trainer who has been certified to teach AdkClaw.

This guide pairs with `level_3/codelab.md`. Read both before delivering.

---

## 1. Cohort prep checklist (T-7 days, then day-of)

### T-7 days
- [ ] Confirm L2 was completed by all students (memory bank + skills working)
- [ ] Verify the L1 sub-agent demo flow yourself — research a topic, watch the Researcher spawn
- [ ] Pre-record the L3 backup demo video (8–10 min — the four demos in sequence)
- [ ] Test the network-down recovery demo on YOUR machine (`ifconfig en0 down`/up cadence — practice)
- [ ] Pre-stage three cron jobs students can delete after the demo (so live `cron_list` shows real entries)

### Day-of (T-30 min)
- [ ] Open the L2 codebase in your editor; clean working tree
- [ ] Have 6 empty terminal tabs ready (one per chapter step + one for `ifconfig` chaos)
- [ ] Verify your phone has Telegram open and can hit your bot
- [ ] Open `adkclaw.dev/e/<event>/fleet` to watch L3 badges light up
- [ ] Start the daemon with verbose logging (`LOG_LEVEL=debug`) — students need to SEE retries

---

## 2. Session run-of-show

L3 is the **systems session.** ~2 hours total. Heaviest reasoning of the workshop.

| Block | Chapter | What you do |
|-------|---------|-------------|
| Re-intro (5 min) | none | "Yesterday we built memory. Today we build a team and a backbone." Recap: the agent has a brain + memory + skills. What it lacks: collaboration, resilience, scheduled work. |
| Branch + verify (5 min) | Ch. 1 | `git checkout -b level-3`. Run L2 tests. |
| Sub-agents (30 min) | Ch. 2 | Whiteboard the six rules of disciplined sub-agents. Live-write `orchestrator.ts`. Walk the four profiles. Live-demo a Researcher spawn with verbose logs. |
| Recovery pyramid (25 min) | Ch. 3 | Whiteboard the pyramid bottom-up. Live-write `classifier.ts` and `engine.ts`. Demo the network-down recovery. |
| Cron + idempotency (15 min) | Ch. 4 | The dedupe-by-minute trick. Live-write `engine.ts`. Demo: schedule a job, restart, see it fire. |
| Heartbeat + dashboard (15 min) | Ch. 5+6 | Live-write `heartbeat.ts` (quiet hours). Show the dashboard. |
| Wow demo (15 min) | Ch. 7 | Four demos: sub-agent → recovery → cron-survives-restart → dashboard. |
| Q&A (5 min) | recap | Take questions. Use FAQ below. |

If running short, condense Ch. 5+6 (heartbeat + dashboard) to 10 min — both are smaller modules. Don't condense Ch. 2 (sub-agents) or Ch. 3 (recovery) — those are load-bearing.

---

## 3. Demo script — the L3 reveal

Four demos. The cumulative effect is "this is no longer a chatbot."

### Setup
- Daemon running locally with `LOG_LEVEL=debug` so retries show in logs
- Phone with Telegram open, your bot loaded
- Mirroring your phone screen to the room
- Browser tab open to `localhost:3000/` (the dashboard)
- Network-toggle command pre-typed in a terminal tab (`ifconfig en0 down`)

### Demo 1 — Researcher sub-agent

> **Say:** "Watch what 'delegate' looks like in agent terms."

Send: `Research Google ADK in depth and save findings to my bank.`

Show the logs while waiting — the parent's tool call → orchestrator spawns → child session opens → web_search → web_fetch x4 → memory_save x3 → child closes → parent receives summary.

> **Say:** "The child saw nothing of our previous conversation. It got identity from the workspace, the task from the parent, and a goal chain telling it why this matters. It returned 4 facts. The parent doesn't know how those facts got there — only that they did. That's clean delegation."

### Demo 2 — Recovery pyramid (live)

> **Say:** "Now the brand-promise demo. Watch the agent face a real network failure."

Type in your terminal: `ifconfig en0 down` (have it pre-typed; just hit Enter).

On Telegram: `What is the current Flutter version?`

Show the daemon logs:
```
[runner] gemini call attempt 1
[healing] retry — error type=network attempt=1 wait=1000ms
[healing] retry — error type=network attempt=2 wait=2000ms
[healing] retry — error type=network attempt=3 wait=4000ms
[healing] fallback Pro → Flash
[healing] fallback also failed — escalate
```

Bot replies: *"I can't reach the web right now. Last I knew, Flutter 3.27 was stable."*

> **Say:** "Three retries with exponential backoff. Then a fallback to a different model. Then a degraded answer instead of a stack trace. That's never crashes."

Type: `ifconfig en0 up`. Send the same prompt. Live result lands.

### Demo 3 — Cron survives restart

> **Say:** "I want my agent to do work tomorrow morning even if my laptop reboots tonight."

Send: `Every weekday at 9 AM, search Google ADK news. Ping me only if something new shipped.`

Bot: *"Scheduled. Job ID: cron_a8f2."*

In a terminal:
```bash
sqlite3 data/adkclaw.db "SELECT id, schedule, action FROM cron_jobs;"
```

Show the row.

```bash
bin/adkclaw stop
bin/adkclaw bg
sqlite3 data/adkclaw.db "SELECT id, schedule FROM cron_jobs;"
```

> **Say:** "Same row. The cron survived the restart because it lives on disk, not in RAM. When 9 AM rolls around tomorrow, it fires. If two daemons happen to be running at 9:00:00, only one fires — the idempotency key guarantees that."

### Demo 4 — Live dashboard

```bash
bin/adkclaw open
```

Browser opens `localhost:3000/`. Show: active sessions, tokens today, cron jobs, sub-agent activity, all auto-refreshing every 5 seconds.

> **Say:** "This is your operations panel. Cron jobs scheduled, sub-agents that ran today, tokens consumed, sessions active. Built into the daemon, no separate frontend, no React build. Plain HTML — defer the complexity until simple breaks."

### If the live demo fails

- Switch to backup recording within 10 seconds
- Don't apologise. "Recorded earlier — same flow. Skipping the live version."
- Continue normally
- Common failure mode: the network-down demo fails on macOS Sonoma+ (`ifconfig` lacks privileges). Fall back to the recording or use `pfctl block` instead.

---

## 4. Common pitfalls (what students hit)

### Pitfall 1: Sub-agent inherits parent history
Student passes `parentMessages` to `extraSystemPrompt`. Tokens explode, child confuses itself.

**Fix**: walk the orchestrator code line-by-line. The child gets identity (via `ContextEngine.bootstrap`) + task + goal ancestry. Nothing else. Live-rewrite the offending line.

### Pitfall 2: All errors retry forever
Classifier missing `auth` in non-retryable list.

**Fix**: open `classifier.ts`, walk the table — `auth: retryable=false`, `permission: retryable=false`. Demo with a deliberately bad API key and watch it escalate immediately.

### Pitfall 3: Cron double-fires
Forgot the UNIQUE constraint on `(job_id, idempotency_key)`. When two daemons restart at the same minute, both fire.

**Fix**: SQL migration. `CREATE UNIQUE INDEX cron_runs_idempotency ON cron_runs(job_id, idempotency_key);`. Re-run the demo.

### Pitfall 4: Heartbeat fires at 3 AM
Quiet-hours condition inverted, OR `getHours()` returns UTC instead of local.

**Fix**: ensure `TZ` env var is set. Walk the inQuiet check on a whiteboard — wrap-around midnight is the easy bug.

### Pitfall 5: Researcher spawns Searcher recursively forever
Researcher's allowlist includes `spawn_search`. The Researcher LLM decides every step needs a search, spawns infinitely.

**Fix**: cap the parent's MAX_TOOL_ROUNDS. The child's spawn count is its parent's tool-call count. Production code adds a depth-counter; preview now if asked.

### Pitfall 6: Dashboard shows zeros
The `/api/admin/status` endpoint returns hardcoded zeros instead of querying SQLite.

**Fix**: live-rewrite `buildStatusPayload()` to query `sessions`, `messages`, `cron_jobs`. Show the dashboard going live.

### Pitfall 7: Allowlist not enforced
Sub-agent calls `shell` even though its profile doesn't allow it.

**Fix**: the runner's function-declaration builder must filter by allowlist. Walk `runner.run()` lines that handle `allowedToolNames`. Live-add the filter.

### Pitfall 8: `ifconfig en0 down` fails (macOS Sonoma+)
Privileges issue.

**Fix**: skip the network-recovery demo, or use `pfctl -e -f /etc/pf.conf` block rules. Or pre-record a video — that's the recommendation now.

---

## 5. FAQ

### About sub-agents
| Question | Answer |
|----------|--------|
| Can sub-agents spawn sub-agents? | Yes (Researcher spawns Searcher). Cap recursion via parent's `MAX_TOOL_ROUNDS`. |
| Can two sub-agents share state? | Only through the workspace (memory bank). Their sessions are isolated. |
| What's the cost difference Pro vs Flash? | Flash is ~10x cheaper. Use Flash for sub-agents unless they need deep reasoning. |
| Can I add a fifth profile? | Yes. Define `id`, `role`, `bootstrap`, `toolAllowlist`, `defaultModel`. Add to `PROFILES` map. |

### About the recovery pyramid
| Question | Answer |
|----------|--------|
| Why retry rate-limit errors? | Because they go away after the rate-limit window. Honour `Retry-After` from the response. |
| Why NOT retry auth errors? | They never get better with time. They get better with a new key. |
| What's the difference between fallback and degrade? | Fallback uses a different primary (Pro → Flash). Degrade reduces capability ("answering from training data only"). |
| Where's "recover" handled? | At the channel/cron level — those subsystems restart themselves. The healing engine handles the runner-level loop. |

### About cron
| Question | Answer |
|----------|--------|
| Why minute-bucket idempotency, not second? | Because `node-cron` has minute granularity. Match dedup tolerance to scheduler resolution. |
| What if the cron fires while the daemon is down? | It misses. Cloud Scheduler in L4 retries; node-cron does not. That's a feature of L4. |
| Can I have second-level cron? | Replace `node-cron` with a millisecond-precision scheduler. Then idempotency-by-second. We don't ship this in L3. |
| How do I delete a cron from outside the agent? | `sqlite3 data/adkclaw.db "DELETE FROM cron_jobs WHERE id='cron_a8f2';"` then restart daemon. |

### About heartbeat
| Question | Answer |
|----------|--------|
| Why quiet hours, not just push notifications mute? | Defence in depth — even if the user forgot to mute Telegram, the agent won't ping at 3 AM. |
| What if heartbeat work takes >30 min and the next tick fires? | Add a `lock` row in SQLite — second tick sees the lock, skips. Production code does this; preview now if asked. |
| Can the heartbeat run more than once per interval? | Yes — the agent can call `force_heartbeat()` if it knows it has urgent work. We don't ship this in L3. |

### About the dashboard
| Question | Answer |
|----------|--------|
| Why HTML and not React? | Because it's read-only and refreshes every 5s. There's no interactivity to manage. |
| Can I add a chart? | Yes. The `/api/admin/status` returns JSON. Drop in Chart.js or vega-lite. |
| Can I expose it publicly? | Don't — it leaks session keys. In L4 we put it behind authentication. |

---

## 6. Recovery scripts — when things break live

### `ifconfig` requires sudo
Pre-type `sudo ifconfig en0 down` and have the password ready, OR fall back to a recording.

### Half the cohort's sub-agent spawns fail
Profiles file has an import bug. Have students paste `npm run typecheck 2>&1 | head -10` in chat — the error usually points right at it.

### Cron isn't firing during the demo
You scheduled it for 9 AM tomorrow but it's currently 10 AM. Schedule for `*/2 * * * *` (every 2 minutes) instead.

### Dashboard returns 404
Routes order matters. The catch-all `/` route must come AFTER the API routes. Walk `src/server/http.ts` and check ordering.

### A student's Researcher spawns infinitely
Hit `Ctrl+C`. Set `MAX_TOOL_ROUNDS=8` in their `.env` and restart. Production code has a recursion-depth cap; mention it as homework.

---

## 7. Timing notes (real-world pacing)

| Block | Planned | Cohort 1 actual range | Adjust |
|-------|---------|----------------------|--------|
| Re-intro | 5 min | 3–8 min | Cap at 8 |
| Branch + verify | 5 min | 5–10 min | If L2 tests fail, pair-debug in chat |
| Sub-agents (Ch. 2) | 30 min | 28–45 min | Six-rules whiteboard takes ~10 min — protect it |
| Recovery pyramid (Ch. 3) | 25 min | 22–40 min | Network-down demo has the most variance |
| Cron (Ch. 4) | 15 min | 12–20 min | Idempotency-key explanation is 5 minutes max |
| Heartbeat + dashboard (Ch. 5+6) | 15 min | 12–25 min | Cut to 10 if running long |
| Wow demos | 15 min | 12–25 min | Skip Demo 4 (dashboard) if very behind — not load-bearing |

If you're 30 min behind by Ch. 4, **show the cron demo from a recording** instead of live-coding the engine. The pattern is the dedupe-on-INSERT trick — worth one slide.

---

## 8. Train-the-trainer notes

### Load-bearing concepts (do not skip)
1. **Sub-agents fork context, never inherit history** — students get this wrong on first attempt almost always
2. **Auth errors never retry** — the classifier table is non-negotiable
3. **Cron idempotency uses a UNIQUE constraint** — the trick is the database, not application code
4. **Quiet hours are defence-in-depth** — agents that ping at 3 AM are not autonomous, they are annoying

### Concepts that can be summarised
- Why exponential backoff specifically (~30 sec — convergence math)
- Why one profile per file (~30 sec — easier to git diff and version)
- Why the dashboard is HTML, not React (~15 sec — defer complexity)

### Concepts that always run long
- The six rules of disciplined sub-agents (Ch. 2) — students keep asking "what about X?" Plan 35 min, not 30.
- The recovery pyramid whiteboard (Ch. 3) — the "why retry rate-limit but not auth" question always comes up
- The network-down demo (Ch. 7) — finicky on modern macOS

### What you absolutely must NOT do
- Skip writing `orchestrator.ts` from blank file
- Show "use LangChain agents" as an alternative — it's a different abstraction stack
- Rush the recovery demo — the wow lands when the agent gracefully degrades
- Use a real production API key in the auth-failure demo — use a deliberately wrong one

### How to certify

You are ready to teach Level 3 when you can:
1. Live-write `MultiAgentOrchestrator.spawn()` from blank file in 12 minutes
2. Recite the recovery pyramid bottom-up with one example per layer
3. Run the full demo script (including the `ifconfig` recovery) without notes
4. Explain the cron idempotency-key trick in one breath

Ahmed certifies via a 60-minute mock-teach over Zoom — you teach Level 3 to him, he plays a confused student.

---

## Where to update this guide after each cohort

After each cohort:
- [ ] Add new pitfalls to Section 4
- [ ] Add new questions to FAQ if asked >1 time
- [ ] Update timing variance numbers
- [ ] Note slides that landed flat or great in `level_3/INSTRUCTOR-LOG.md`
