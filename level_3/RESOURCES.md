# Level 3 — Resources

Curated links + ideas for students AND instructors. Same template as L2.

---

## Reference docs

### Sub-agents and orchestration
- [Anthropic — Multi-agent orchestration patterns](https://www.anthropic.com/research/building-effective-agents) — orchestrator-worker, evaluator-optimiser, parallelisation
- [LangGraph multi-agent](https://langchain-ai.github.io/langgraph/concepts/multi_agent/) — alternate vendor's framing (graph framework)
- [ADK 2.0 graph framework](https://google.github.io/adk-docs/) — Google's official multi-agent direction (Cloud Next 2026)
- [Google's Marathon Planner codelab](https://codelabs.developers.google.com/marathon-planner) — sub-agents in production

### Resilience and error recovery
- [Google SRE Book — Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) — canonical reference for retry + backoff
- [AWS Builders' Library — Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — exponential backoff math
- [Anthropic — Tool use error handling](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — fallback patterns
- [Gemini error reference](https://ai.google.dev/gemini-api/docs/troubleshooting) — what each status code means

### Cron and scheduled work
- [`node-cron` docs](https://www.npmjs.com/package/node-cron) — the library we use
- [Cron expression reference](https://crontab.guru/) — interactive cron syntax helper
- [Cloud Scheduler (preview for L4)](https://cloud.google.com/scheduler/docs) — what we migrate to
- [SQLite UNIQUE constraint](https://www.sqlite.org/lang_createtable.html#uniqueconst) — the idempotency trick

### Observability
- [Cloud Logging structured logs](https://cloud.google.com/logging/docs/structured-logging) — what we'll switch to in L4
- [Server-Sent Events (SSE) MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — for the production dashboard's stream endpoint

---

## Sister codelabs from Google

| For our pillar | Google codelab | Why |
|----------------|----------------|-----|
| Multi-agent orchestration | [Build agents with ADK Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) | Same orchestrator pattern in Python |
| Specialised sub-agents | [Marathon Planner Codelab](https://codelabs.developers.google.com/marathon-planner) | Five specialised agents collaborating |
| Resilience patterns | [Reliability for AI agents](https://cloud.google.com/architecture/reliability-best-practices-ai-agents) | Cloud-native patterns applied to agents |
| Cron and triggers | [Cloud Scheduler quickstart](https://cloud.google.com/scheduler/docs/quickstart) | Foreshadow of L4 |
| Live dashboards | [Cloud Run + Firestore real-time dashboards](https://cloud.google.com/firestore/docs/listen) | The L4 production version |

---

## Sample prompts to demo (test your agent with these)

### After Chapter 2 (Sub-agents)
```
Spawn a researcher to investigate Google ADK 2.0 graph framework.
Have a search sub-agent find me the top 3 results for "Vertex Vector Search pricing".
Tell the coder sub-agent to check if data/sessions.db has the cron_jobs table.
```

### After Chapter 3 (Recovery pyramid)
```
[disable network] What is the current Flutter version?
                  (verifies retry → fallback → degrade)

Tell me the current Flutter version using a deliberately bad API key.
                  (verifies auth errors escalate immediately)

[rate-limit yourself by spamming] Search for Flutter news 10 times.
                  (verifies rate-limit retry honours Retry-After)
```

### After Chapter 4 (Cron)
```
Every weekday at 9 AM, search Google ADK news. Ping me only if something new shipped.
Schedule a one-time job 5 minutes from now to remind me to drink water.
List my scheduled jobs.
Remove the water-reminder job.
```

### After Chapter 5 (Heartbeat)
```
Add to HEARTBEAT.md: "OPEN: Check Vertex AI release notes weekly."
[wait 30 min during working hours]
                  (verifies heartbeat picks up the open task)
```

### Stress-test prompts
```
Spawn 4 researchers in parallel to investigate 4 different topics.
                  (tests spawnParallel + token cost)

[disable network for 5 minutes] Continue chatting normally.
                  (tests degraded operation persistence)

Schedule a cron for "* * * * *" (every minute).
                  (tests rapid-fire idempotency under restart)
```

---

## Inspiration — articles, talks, tweets

### On multi-agent systems
- [Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents) — workflow vs agent, when to use which
- [Lilian Weng — Multi-agent collaboration](https://lilianweng.github.io/posts/2023-06-23-agent/) — academic survey
- [DeepMind — AlphaCode 2's two-stage architecture](https://www.deepmind.com/research) — generation + verification as two specialised agents

### On resilience patterns
- [Google SRE Workbook — Implementing SLOs](https://sre.google/workbook/implementing-slos/) — what "never crashes" actually means in practice
- [Charity Majors on observability](https://charity.wtf/) — production debugging mindset
- [Marc Brooker — Backoff with jitter](https://brooker.co.za/blog/2015/03/21/backoff.html) — why jitter matters at scale

### On scheduled work
- [Mike Perham — Sidekiq's design](https://github.com/sidekiq/sidekiq/wiki/Design) — idempotency keys and at-least-once semantics
- [Google — Scheduling at scale (Borg paper)](https://research.google/pubs/large-scale-cluster-management-at-google-with-borg/) — the philosophical ancestor of Cloud Scheduler

---

## Deep dives — for students who want to go beyond Level 3

### After Chapter 2 (Sub-agents)
- Read [`src/multi-agent/orchestrator.ts`](https://github.com/dahabit/adkclaw/blob/main/src/multi-agent/orchestrator.ts) — the production version with `spawnParallel()` (capped at 4 concurrent)
- Read [`src/multi-agent/profiles/`](https://github.com/dahabit/adkclaw/tree/main/src/multi-agent/profiles) — all four profile definitions
- Read [`src/tools/spawn.ts`](https://github.com/dahabit/adkclaw/blob/main/src/tools/spawn.ts) — how the spawn-tools wire allowlists into the runner

### After Chapter 3 (Recovery pyramid)
- Read [`src/healing/classifier.ts`](https://github.com/dahabit/adkclaw/blob/main/src/healing/classifier.ts) — production version with retry-after parsing
- Read [`src/healing/engine.ts`](https://github.com/dahabit/adkclaw/blob/main/src/healing/engine.ts) — `protect()` combining retry + fallback
- Read [`src/healing/types.ts`](https://github.com/dahabit/adkclaw/blob/main/src/healing/types.ts) — full error-type discriminated union

### After Chapter 4 (Cron)
- Read [`src/cron/engine.ts`](https://github.com/dahabit/adkclaw/blob/main/src/cron/engine.ts) — production version with `cron_runs` audit table
- Read the SQLite migration — `CREATE UNIQUE INDEX cron_runs_idempotency...`
- Compare with Cloud Scheduler in L4 — different idempotency model (Cloud Scheduler retries on 5xx)

### After Chapter 5 (Heartbeat)
- Read [`src/cron/heartbeat.ts`](https://github.com/dahabit/adkclaw/blob/main/src/cron/heartbeat.ts) — full version with lock-row pattern
- Note how the runner's `beforeTurn` callback can rewrite `HEARTBEAT.md` to clear handled tasks

### After Chapter 6 (Dashboard)
- Read [`src/server/http.ts`](https://github.com/dahabit/adkclaw/blob/main/src/server/http.ts) — production version with SSE stream
- Read the dashboard CSS — Style A tokens (slate-blue, cloud-blue, Space Grotesk)
- Look at how L4 puts the dashboard behind Cloud Run authentication

---

## "If a student asks X..."

Quick reference for instructors during Q&A.

| Question | Point them to | One-liner |
|----------|---------------|-----------|
| "How is this different from LangGraph?" | `docs/technical-decisions.md` | "Same idea, different abstraction layer. LangGraph hides the spawn pattern; we want students to see it." |
| "Can I use Vertex AI Agent Builder instead?" | Vertex AI Agent docs | "Yes — for pre-built workflows. AdkClaw teaches the underlying pattern so you can migrate either way." |
| "What about A2A protocol?" | Cloud Next 2026 announcement | "Phase 4 stretch. Once two AdkClaw agents can speak A2A, they can collaborate across networks." |
| "Why not retry on 4xx?" | Classifier table | "4xx is a client error — your code is wrong. Retrying makes it wrong again. Fix the code." |
| "What's the max retries?" | `withRetry` opts | "Default 3. We cap because longer retries push past Telegram's response window." |
| "Can I have a global Researcher pool?" | Workspace co-mounting | "Yes — same workspace, multiple parents share the same Researcher. They'll race on the same memory bank, idempotent by design." |
| "Heartbeat too slow?" | `intervalMs` config | "Set lower in `.env` (default 30 min). Don't go below 5 min — Gemini Pro turns add up." |
| "Can the cron call a sub-agent?" | Yes, via `delivery` | "The cron's action can reference a sub-agent profile. Production tool: `cron_add` accepts `via: 'researcher'`." |
| "How do I add a Slack channel?" | Channel adapter pattern | "Implement `MessageNormalizer` → `runner.run()` → `bot.deliver()`. Same shape as Telegram. Shipped as Phase 4 plugin in roadmap." |
| "What if Gemini is down for 30 minutes?" | Fallback degraded mode | "Agent answers from training data only. Logs the outage. Picks up the moment Gemini recovers." |
| "Can two agents share the dashboard?" | Per-instance dashboards | "Each daemon runs its own. For aggregated multi-agent view, see L4 + Firestore queries." |
| "Why isolate sub-agent sessions?" | Audit + crash isolation | "Each child's session is a queryable trace. If a child crashed, you can replay it independently." |

---

## Cohort fleet view

After completing L3, students light up the **third pillar** on the fleet:
**[adkclaw.dev/e/<event>/fleet](https://adkclaw.dev/e/sandbox/fleet)**

The L3 badge unlocks when a sub-agent successfully spawns AND returns a non-error result. Students who complete fastest see their third pillar light first.

---

## Privacy + ethics notes for instructors

- Sub-agents inherit the **workspace** memory bank. Tell students: anything they put in a fact is visible to every sub-agent. If they want privacy, namespace the workspace.
- The `ALLOWED_SENDERS` allowlist is per-channel. The cron + heartbeat send via the same channel; tell students to triple-check the allowlist before scheduling.
- Heartbeat quiet hours apply to **delivery**, not **work**. The agent can still process; it just won't ping. If a student wants the agent to also pause work at night, add a `process_only_during_work_hours` flag.
- The recovery pyramid logs every retry. Tell students to scrub PII from error messages before shipping to production logs (a Phase 2 cleanup).

---

## Where to put feedback

- Open an issue: [github.com/dahabit/adkclaw/issues](https://github.com/dahabit/adkclaw/issues) with the label `level-3`
- Or DM Ahmed: [@dahabdev on X](https://x.com/dahabdev)
