# Instructor Answer Keys

Each `solutions/level_N/` is a **complete, runnable** TypeScript project — the
finished state of that level's `level_N/starter/`.

## Relationship to git tags

The legacy `v0-starter` … `v5-complete` tags are kept in the git history for
reference (the `codelab/starter/` tree they point at has been removed). Solutions
under this directory are the maintained artifact; the tags are historical
archaeology only.

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
