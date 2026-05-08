# Evals — "is the agent's answer actually good?"

Most agent workshops ship code that runs but never measure whether it answers correctly. This directory closes that gap.

## What's here

```
evals/
├── README.md                 ← this file
├── harness.ts                ← runs a case file against your daemon, scores it, snapshots the response
├── runner.ts                 ← CLI entry: `npm run eval [-- --update-snapshots]`
├── cases/
│   ├── L1-tool-call.json     ← does the agent call web_search when asked about news?
│   ├── L2-memory-recall.json ← does the agent recall a fact saved in a previous turn?
│   ├── L3-isolation.json     ← does a SearchAgent refuse to call spawn_coder?
│   ├── L4-deploy-gates.json  ← do all six L4 env vars FATAL the daemon when missing?
│   └── L5-security.json      ← do GET / and POST /api/cron/fire return 401 without creds?
└── snapshots/                ← committed expected outputs (per case)
```

## Why eval, not just test?

| Tests answer | Evals answer |
|---|---|
| Does this function return the right value for input X? | Does the *agent* take the right action when a user says X? |
| Compiles, doesn't crash | Is the answer relevant, accurate, formatted correctly? |
| Deterministic | Sometimes-stochastic, scored on a rubric |
| Run in CI | Run before personality changes, before model bumps, before deploys |

A test failing is a regression. An eval failing is a behavior shift — could be regression, could be intended change. You eyeball it, then either fix the agent or update the snapshot.

## Run them

```bash
# Daemon must be running on $PORT (default 3000)
npm run dev &

# Run all evals
npm run eval

# Update snapshots after a deliberate behavior change
npm run eval -- --update-snapshots
```

## Case format

A case is a JSON file with three sections:

```json
{
  "id": "L1-tool-call",
  "level": 1,
  "intent": "Verify the agent calls web_search when the user asks about something time-sensitive.",
  "preconditions": {
    "session": "eval-l1-tool-call",
    "fixtures": []
  },
  "input": {
    "userText": "What's the latest stable Node.js version?"
  },
  "asserts": [
    { "type": "tool_called", "name": "web_search" },
    { "type": "reply_contains", "value": "Node" },
    { "type": "no_tool_called", "name": "filesystem" }
  ]
}
```

Assertions:

- `tool_called` — the agent invoked the named tool at least once
- `no_tool_called` — the named tool was NOT invoked
- `reply_contains` — case-insensitive substring match
- `reply_matches` — regex match against the reply
- `reply_length_lt` / `reply_length_gt` — length bounds (catch verbose-mode regressions)
- `tool_round_count_eq` — exact rounds count (deterministic loops)

## When evals fail

1. **Run the case in isolation**: `npx tsx evals/runner.ts cases/<id>.json --verbose`
2. **Inspect the snapshot diff**: `git diff evals/snapshots/<id>.json`
3. **Decide**: regression (fix the agent) vs. intended change (update snapshot)
4. **Update**: `npm run eval -- --update-snapshots --filter=<id>`

## Per-level rubric

The rubric below is what the cohort uses to grade student submissions. Pin it to your `THREAT_MODEL.md` review schedule.

| Level | Pass criterion |
|---|---|
| L1 | All five L1 cases green (tool calls + replies match) |
| L2 | Memory recall case passes after restart |
| L3 | Sub-agent isolation case proves SearchAgent can't escalate to spawn_coder |
| L4 | Deploy-gates case proves all six env vars are FATAL on missing |
| L5 | Security case proves curl probes return 401 |

## Cost note

Each eval run = N Gemini calls (one per case, plus tool dispatch). Stay inside the free tier with 5–10 cases per run. Don't enable in pre-commit; run on PR + before deploy.

## Future

- Multi-turn evals (currently single-turn only)
- Auto-generated cases from production logs
- Cross-model evals (run the same case on Pro vs Flash; flag divergences)
- Scoring with `gemini-3-flash-preview` as a judge model
