# Architecture — Three-Repo Layout

AdkClaw lives in three GitHub repositories. This doc explains what's in each so contributors and instructors don't waste time looking in the wrong place.

## The three repos

| Repo | Visibility | What's in it |
|---|---|---|
| **`dahabit/adkclaw`** | Public | Workshop curriculum + reference TypeScript implementation that students study and clone. **You are here.** |
| **`dahabit/adkclaw-platform`** | Private | The Next.js frontend + Node API powering [adkclaw.dev](https://adkclaw.dev) — cohort fleet, registration, badges. |
| **`dahabit/adkclaw-instructor`** | Private | Train-the-trainer materials: per-level INSTRUCTOR.md, slide decks, run-of-show, briefs, strategy docs. |

## What's in this public repo

```
adkclaw/
├── README.md                 ← students start here
├── ARCHITECTURE.md           ← this file
├── CONTRIBUTING.md
├── PREWORK.md                ← 7-day pre-workshop guide
├── POST_WORKSHOP.md          ← graduation + extension projects
├── workshop.config.json      ← shared metadata (model IDs, level durations)
│
├── codelab/starter/          ← Day-1 starter scaffold (clone this, build on it)
│   ├── package.json
│   ├── src/
│   ├── workspace.example/
│   └── docs/
│
├── level_0/                  ← Architecture tour (presentation, no code)
│   ├── README.md
│   ├── codelab.md
│   └── RESOURCES.md
├── level_1/ … level_4/       ← Per-level codelab.md + README.md + RESOURCES.md
│
├── src/                      ← Reference implementation (post-L4 finished agent)
│                              study this; don't clone it as your starting point
├── docs/                     ← Tech stack, capabilities, internals
├── scripts/                  ← setup.sh, preflight.sh
└── extensions/               ← Optional post-workshop projects (Slack, RAG, voice)
```

### Where students start

**Always `codelab/starter/`** — that's the canonical Day-1 scaffold. Each codelab walks students through growing it incrementally:

```bash
cd codelab/starter
npm install
npm run setup      # interactive: pick agent name, paste keys
# follow level_0/codelab.md, then 1, 2, 3, 4
```

If a student falls behind, they can fast-forward to a level checkpoint via git tags (see *Level checkpoints* below).

### What `src/` is for

`src/` at the repo root is the **finished reference implementation** — the agent after Level 4 with all 21 tools, multi-agent orchestration, healing, cron, Firestore adapter. Treat it as the answer key to study, not the starter to clone.

## Level checkpoints (git tags)

Students who get stuck in Level 3 don't need to redo Levels 1–2 from scratch. The repo ships tagged checkpoints of `codelab/starter/` at each level boundary:

| Tag | State of `codelab/starter/` |
|---|---|
| `v0-starter` | Day-1 starter (no agent loop yet) |
| `v1-complete` | Post-Level 1: agent loop + 3 tools + Telegram + SQLite sessions |
| `v2-complete` | Post-Level 2: + memory bank + compaction + skills |
| `v3-complete` | Post-Level 3: + sub-agents + healing + cron + dashboard |
| `v4-complete` | Post-Level 4: + Cloud Run + Firestore + webhook + scheduler |
| `v5-complete` | Post-Level 5: + admin auth + OIDC + BudgetGuard FATAL + Cloud DLP + Firestore rules |

To rescue yourself mid-workshop:

```bash
git stash                       # save your work-in-progress
git checkout v2-complete -- codelab/starter/
# you now have a fresh L2 baseline; continue from L3
```

These tags are maintained against the same `codelab/starter/` directory — there is no separate `level_N/` working tree.

## What's in `dahabit/adkclaw-instructor` (private)

Instructors and co-trainers — request access. This repo has:

- `curriculum/level_0/INSTRUCTOR.md` … `level_4/INSTRUCTOR.md` — per-level run-of-show, talking track, common pitfalls, demo recovery
- `curriculum/teaching-guide.md` — train-the-trainer master document
- `slides/` — Marp slide decks (one per level)
- `briefs/` — content-generation briefs (the "secret sauce" for codelabs)
- `strategy/` — curriculum design rationale, content index, build plan
- `workspace-snapshots/` — sample `workspace/` instances for demos

If you're delivering a cohort, that repo is your starting point — not this one.

## What's in `dahabit/adkclaw-platform` (private)

The website + API that runs at [adkclaw.dev](https://adkclaw.dev):

- `platform/frontend/` — Next.js app (cohort fleet, registration, profile pages, badge display)
- `platform/api/` — Node/TypeScript API (event creation, builder secrets, badge ingestion)
- `infra/` — Cloud Build, deploy scripts, environment config

Students never touch this repo. Their agent talks to it via HTTP only when they opt-in to the cohort fleet (Level 0 step "Connect to the Cohort Fleet").

## When in doubt

- **Building or studying the agent?** Stay in this public repo.
- **Running a workshop cohort?** You need `dahabit/adkclaw-instructor`.
- **Working on the website?** That's `dahabit/adkclaw-platform`.

If you find a reference in this repo to something that no longer exists (a `solutions/` directory, a `level_N/` working tree, a private file), please open an issue — the split is recent and stragglers may exist.
