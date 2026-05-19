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
├── level_0/                  ← Architecture tour (presentation, no code)
│   ├── README.md
│   ├── codelab.md
│   └── RESOURCES.md
├── level_1/                  ← Build the Brain (NEW per-level-starter model)
│   ├── starter/              ← self-contained Level 1 starter (own package.json, src/)
│   │   ├── package.json
│   │   ├── src/
│   │   ├── workspace.example/
│   │   ├── docs/teaching-guide.md
│   │   └── scripts/verify.ts (offline checkpoint)
│   ├── codelab.md (anchored to starter/ markers)
│   └── README.md
├── level_2/ … level_5/       ← Per-level codelab.md, README.md, RESOURCES.md (migrating to per-level starters)
│
├── solutions/
│   ├── level_1/              ← complete answer key (generated from v1-complete tag)
│   │   ├── package.json, src/, workspace/
│   │   ├── docs/teaching-guide.md
│   │   └── README.md
│
├── codelab/starter/          ← legacy monolithic starter (still used by L2–L5)
│   ├── package.json
│   ├── src/
│   ├── workspace.example/
│   └── docs/
│
├── src/                      ← Reference implementation (post-L4 finished agent)
│                              study this; don't clone it as your starting point
├── docs/                     ← Tech stack, capabilities, internals, teaching-guide.md
├── scripts/                  ← setup.sh, preflight.sh
└── extensions/               ← Optional post-workshop projects (Slack, RAG, voice)
```

### Where students start

**Level 1** (new model):
```bash
cd level_1/starter
npm install
npm run setup      # interactive: pick agent name, paste keys
npm run verify     # offline checkpoint (tsc + vitest)
```

**Levels 2–5** (being migrated, currently traditional):
```bash
cd codelab/starter
npm install
npm run setup
# follow level_2/codelab.md through level_5/codelab.md
```

If a student falls behind, they can fast-forward via git tags (see *Level checkpoints* below) for Levels 2–5. Level 1 students can also reference `solutions/level_1/` as an answer key.

### What `src/` is for

`src/` at the repo root is the **finished reference implementation** — the agent after Level 4 with all 21 tools, multi-agent orchestration, healing, cron, Firestore adapter. Treat it as the answer key to study, not the starter to clone.

## Level checkpoints

### Level 1 (new model)

**Offline checkpoints** via `npm run verify`:
- Runs `tsc --noEmit` + `vitest run` — no Gemini key, no network
- Type-checks and tests the student's marker fills per section
- Deterministic pass/fail within 10 seconds

**Answer keys** in `solutions/level_1/`:
- Complete, runnable finished Level 1 (generated from `v1-complete` git tag)
- Students can diff their work: `diff ~/adkclaw/level_1/starter/src/ ~/adkclaw/solutions/level_1/src/`

### Levels 2–5 (traditional git-tag model, being migrated)

The repo ships tagged checkpoints of `codelab/starter/` at each level boundary:

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

These tags are maintained against the same `codelab/starter/` directory.

## What's in `dahabit/adkclaw-instructor` (private)

Instructors and co-trainers — request access. This repo has:

- `curriculum/level_0/INSTRUCTOR.md` … `level_5/INSTRUCTOR.md` — per-level run-of-show, talking track, common pitfalls, demo recovery
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

If you find a reference in this repo to something that no longer exists (a `level_N/` working tree, a private file), please open an issue — the split is recent and stragglers may exist.
