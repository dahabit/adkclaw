# Level 3: The Agent Army

![Level 3: The Agent Army](img/recovery-pyramid.png)

**Spawn specialized sub-agents, build the recovery pyramid that ensures your agent never crashes, and add cron + heartbeat so it works while you sleep.**

One agent is a tool. Many agents collaborating is a system. Today you build the system. You'll spawn isolated sub-agents with forked context (never sharing parent history), implement the five-tier recovery pyramid (retry → fallback → recover → degrade → escalate) that turns "the agent never crashes" into a design constraint, schedule cron jobs that survive restart with idempotency keys, and add a heartbeat loop with quiet hours so your agent runs 24/7 without waking you at 3 AM.

## 🎯 What You'll Learn

| Concept | Description |
|---------|-------------|
| **Sub-agent orchestration** | Isolated sessions, forked context, goal ancestry |
| **Specialized profiles** | SearchAgent (Flash), ResearcherAgent (Pro), CommunicatorAgent, CoderAgent |
| **Tool allowlists per profile** | Each profile sees only its tools |
| **Recovery pyramid** | Retry → Fallback → Recover → Degrade → Escalate |
| **Error classification** | Retryable vs escalatable categories |
| **Exponential backoff** | 1s → 2s → 4s with rate-limit headers |
| **Cron with idempotency keys** | Minute-bucket dedup prevents missed-tick double-fires |
| **Heartbeat with quiet hours** | Periodic self-check that respects 22:00–07:00 |
| **Admin dashboard** | Live HTML status at `/`, auto-refreshing |

## ✅ What You'll Build

By the end of this level, you will have:

- 🤖 A `MultiAgentOrchestrator` that spawns isolated sub-agents
- 👥 Four specialized profiles (Search/Researcher/Communicator/Coder)
- 🛡️ A `HealingEngine` enforcing the recovery pyramid
- 🔍 An error classifier that decides retry vs escalate
- ⏰ A `CronEngine` with persistent jobs + idempotency keys
- 💓 A heartbeat loop that respects quiet hours
- 📊 A live admin dashboard at `localhost:3000/`

## 📋 Prerequisites

- ✅ **Level 2 completed** — agent has persistent memory + skills
- ✅ Cloud Shell environment + `set_env.sh` sourced

## 🚀 Quick Start

### 1. Clone and bootstrap

```bash
cd ~/adkclaw/level_3
source ~/adkclaw/set_env.sh
npm install
npm run typecheck
```

### 2. Implement the orchestrator

`src/multi-agent/orchestrator.ts` — `spawn()` method. Critical: **fork context, don't share parent history**.

### 3. Implement the four profiles

| Profile | File | Tools allowed | Default model |
|---------|------|---------------|--------------|
| SearchAgent | `src/multi-agent/profiles/SearchAgent.ts` | web_search, web_fetch | Flash |
| ResearcherAgent | `src/multi-agent/profiles/ResearcherAgent.ts` | + memory_*, spawn_search | Pro |
| CommunicatorAgent | `src/multi-agent/profiles/CommunicatorAgent.ts` | message_user only | Flash |
| CoderAgent | `src/multi-agent/profiles/CoderAgent.ts` | filesystem, shell, code_fix | Pro |

### 4. Implement the recovery pyramid

`src/healing/classifier.ts` — categorize errors. `src/healing/engine.ts` — `withRetry`, `withFallback`, `protect`.

### 5. Implement cron with idempotency

`src/cron/engine.ts` — load jobs from SQLite, schedule via node-cron, generate `<jobId>:<floor(ms/60000)>` keys for `cron_runs` UNIQUE constraint.

### 6. Run the daemon

```bash
npm run dev
```

### 7. Test the wow demos

**Sub-agent spawn:**
```
You: Research Google ADK in depth and save findings.
Bot: Spawning ResearcherAgent... [9 tool calls later]
     ✓ Saved 4 facts to bank/facts/. Summary attached.
```

**Recovery pyramid (live):**
```bash
# Pull the network mid-conversation
$ ifconfig en0 down
[Telegram] What's the current Flutter version?
[1s] retry... [2s] retry... [4s] retry...
[fallback Pro → Flash also fails]
Bot: I can't reach the web right now. Last I knew, Flutter 3.27 was stable.
$ ifconfig en0 up
```

**Cron + heartbeat:**
```
You: Every weekday at 9 a.m., search Google ADK news. Ping me only if something new shipped.
Bot: Scheduled. Job ID: cron_a8f2.
$ sqlite3 data/adkclaw.db "SELECT * FROM cron_jobs;"   ← shows persisted job
[restart daemon — job survives]
[next 9 a.m. — fires autonomously]
```

**Admin dashboard:**
```bash
$ bin/adkclaw open
# Browser opens http://localhost:3000/
# Live: sessions, tokens, channel breakdown, sub-agent activity
```

## 🏆 Light Up Your Level 3 Badge

**Trigger**: a sub-agent spawns (any of `spawn_search` / `spawn_researcher` / `spawn_communicator` / `spawn_coder` / generic `spawn_agent`) AND returns a result without erroring out of the recovery pyramid.

If you registered at [adkclaw.dev/join/sandbox](https://adkclaw.dev/join/sandbox) (see [Level 0 → Connect to the Cohort Fleet](../level_0/README.md#-optional-connect-to-the-cohort-fleet)), your third pillar lights up on the fleet view. If not registered, no-op.

## 📖 Full Codelab

**[📚 Level 3 Codelab →](https://codelabs.developers.google.com/adkclaw-level-3/instructions)**

## 🏗️ Architecture

```
                          ESCALATE  ↑ tell the user
                            DEGRADE ↑ reduced capability
                              RECOVER ↑ restart subsystem
                              FALLBACK ↑ Pro → Flash
                              RETRY ↑ exponential backoff
```

## 🔑 Key Patterns

### Sub-agent with forked context (NON-NEGOTIABLE)

```typescript
// src/multi-agent/orchestrator.ts
async spawn(req: SpawnRequest): Promise<SpawnResult> {
  const childKey = `subagent:${req.parentSessionKey}:${randomKey()}`;
  this.sessions.createSession({ key: childKey, kind: 'isolated', parentKey: req.parentSessionKey });

  // CRITICAL: child does NOT see parent's history
  const extraSystemPrompt = framing + profileText + goalText;
  const allowedToolNames = profile?.toolAllowlist;

  return await this.runner.run({
    sessionKey: childKey,
    message: req.task,
    extraSystemPrompt,
    allowedToolNames,
    ...
  });
}
```

### Recovery pyramid

```typescript
// src/healing/engine.ts
async protect<T>(primary: () => Promise<T>, fallback: () => Promise<T>) {
  return this.withFallback(() => this.withRetry(primary), fallback);
}
```

### Cron idempotency key

```typescript
// src/cron/engine.ts
const idempotencyKey = `${jobId}:${Math.floor(Date.now() / 60000)}`;
try {
  db.prepare('INSERT INTO cron_runs (job_id, idempotency_key, fired_at) VALUES (?, ?, ?)')
    .run(jobId, idempotencyKey, Date.now());
  await runJob();
} catch (e) {
  if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return; // dedup hit, skip
  throw e;
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Sub-agent hangs forever | Add timeout via `Promise.race()` — covered in chapter 1 |
| Auth errors retry instead of escalating | Classifier missing `auth` in skip list — check `classifier.ts` |
| Cron job double-fires | Idempotency key not unique. Check `cron_runs` UNIQUE constraint. |
| Heartbeat fires at 3 AM | Quiet hours not enforced. Check `heartbeat.ts` time check. |

## 📁 Files Overview

| File | What you implement |
|------|-------------------|
| `src/multi-agent/orchestrator.ts` | `spawn()`, `resolveProfile()`, isolation logic |
| `src/multi-agent/profiles/{Search,Researcher,Communicator,Coder}Agent.ts` | All four profile definitions |
| `src/healing/classifier.ts` | `classifyError()` — error → category mapping |
| `src/healing/engine.ts` | `withRetry()`, `withFallback()`, `protect()` |
| `src/cron/engine.ts` | Job scheduling + idempotency |
| `src/cron/heartbeat.ts` | Periodic self-check + quiet hours |
| `src/server/http.ts` | `DASHBOARD_HTML` constant + admin route |
| `bin/adkclaw` | `bg`/`stop`/`status`/`logs`/`open` commands |

## 🏁 Ready for Level 4?

Before you continue, verify:

- [ ] A sub-agent returned a real result to the parent (test: parent calls `spawn_researcher({task: "..."})`, gets a structured reply)
- [ ] Cron fired at least twice without double-running — check `cron_runs` table for unique keys
- [ ] Heartbeat is publishing every 30 minutes (check `workspace/HEARTBEAT.md` mtime)
- [ ] Healing engine retried at least one transient error — check logs for `[healing] retry attempt=2`
- [ ] Admin dashboard at `localhost:3000/` shows live state

If sub-agent isolation is broken (parent context leaking), do not proceed to L4. Cloud Run amplifies cost mistakes.

## ➡️ Next Level

Your agent runs 24/7 on your laptop. Time to put it on Google Cloud, reachable from any phone, anywhere.

**[Level 4: Ship to the Cloud →](../level_4/README.md)**

Containerize, deploy to Cloud Run, migrate state to Firestore, switch Telegram to webhook mode, schedule cron via Cloud Scheduler. Your agent becomes truly global.

---

*Your agent has a team now, and never crashes. Onward.* 🤖🤖🤖
