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
├── level_1/ … level_4/       ← Per-level starters (one self-contained project per level)
│   ├── starter/              ← own package.json, src/, workspace.example/
│   │   ├── package.json
│   │   ├── src/              ← with //REPLACE-* markers
│   │   ├── workspace.example/
│   │   └── scripts/verify.ts (offline checkpoint)
│   ├── codelab.md            ← anchored to starter/ markers
│   └── README.md
│
├── solutions/
│   ├── level_1/ … level_4/   ← complete answer keys (one per level)
│   │   ├── package.json, src/, workspace/
│   │   └── README.md
│
├── src/                      ← Reference implementation (post-L4 finished agent)
│                              study this; don't clone it as your starting point
├── docs/                     ← Tech stack, capabilities, internals, teaching-guide.md
├── scripts/                  ← setup.sh, preflight.sh
├── RUNBOOK.md                ← operating your deployed agent (L4 graduates)
└── extensions/               ← Optional post-workshop projects (Slack, RAG, voice)
```

### Where students start

```bash
cd level_N/starter             # N = 1, 2, 3, or 4
npm install
npm run setup                  # interactive: pick agent name, paste keys (L1 only)
npm run verify                 # offline checkpoint (tsc + vitest)
```

Each level is a standalone project — `npm install` per level. Students can reference `solutions/level_N/` as the answer key. There is no longer a single monolithic starter that grows across levels.

### What `src/` is for

`src/` at the repo root is the **finished reference implementation** — the agent after Level 4 with all 21 tools, multi-agent orchestration, healing, cron, Firestore adapter. Treat it as the answer key to study, not the starter to clone.

## Level checkpoints

**Offline checkpoints** via `npm run verify`:
- Runs `tsc --noEmit` + `vitest run` — no Gemini key, no network
- Type-checks and tests the student's marker fills per section
- Deterministic pass/fail within 10 seconds

**Answer keys** in `solutions/level_N/`:
- Complete, runnable finished Level N
- Students can diff their work: `diff -ru ~/adkclaw/level_N/starter/src ~/adkclaw/solutions/level_N/src`
- The diff should show only `//REPLACE-*` marker blocks — that's the clean-room invariant.

> **Legacy tags.** Historical tags `v0-starter` … `v5-complete` (pointing at the now-removed `codelab/starter/`) remain in the git history for reference. They are not the canonical entry point and are not referenced from any current codelab or README. New cohorts use `level_N/starter/` + `solutions/level_N/`.

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

If you find a reference in this repo to something that no longer exists (a `level_N/` working tree, a private file), please open an issue — the split is recent and stragglers may exist.
