# Instructor Answer Keys

Each `solutions/level_N/` is a **complete, runnable** TypeScript project — the
finished state of that level's `level_N/starter/`.

## Relationship to git tags

`solutions/level_1/` is generated from the verified tag `v1-complete`
(`git show v1-complete:codelab/starter/`). The legacy tags `v0-starter` …
`v5-complete` are kept for reference. Solutions are the maintained artifact;
tags are the historical checkpoint.

## Verifying a solution

    cd solutions/level_1 && npm install && npm run verify

`verify` is offline: `tsc --noEmit` + `vitest run`. No Gemini key, no network.

## Diffing a starter against its answer key

    diff -ru level_1/starter/src solutions/level_1/src

Every `//REPLACE-*` marker in the starter corresponds to a filled-in region
in the solution.

## Cumulative property

Solutions grow monotonically: `solutions/level_2/src` (added in Stage 2) will
be a strict superset of `solutions/level_1/src`. Stage 1 ships `level_1` only.
