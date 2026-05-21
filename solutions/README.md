# Instructor Answer Keys

Each `solutions/level_N/` is a **complete, runnable** TypeScript project — the
finished state of that level's `level_N/starter/`.

## Relationship to git tags

The legacy `v0-starter` … `v5-complete` tags are kept for reference. Solutions
under this directory are the maintained artifact; tags are the historical
checkpoint for the monolithic `codelab/starter/` flow (which is removed in
Stage 3 of the restructure).

## Verifying a solution

    cd solutions/level_1 && npm install && npm run verify

`verify` is offline: `tsc --noEmit` + `vitest run`. No Gemini key, no network.

## Diffing a starter against its answer key

    diff -ru level_1/starter/src solutions/level_1/src

Every `//REPLACE-*` marker in the starter corresponds to a filled-in region
in the solution.

## Cumulative property

Solutions grow monotonically: each `solutions/level_N/src` is a strict
superset of `solutions/level_{N-1}/src`. As of Stage 2, all four levels
(`solutions/level_1` through `solutions/level_4`) ship complete. L5 hardening
is folded into L3 (startup gates) and L4 (OIDC, webhook secret, DLP).
