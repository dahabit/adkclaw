# Arabic Translation Framework

AdkClaw ships in English by default. The MENA dev community is the workshop's strategic anchor — Arabic translations are first-class.

## What's translated

| File | English | Arabic | Status |
|---|---|---|---|
| Level 0 README | `level_0/README.md` | `level_0/README.ar.md` | ✅ shipped |
| Level 0 codelab | `level_0/codelab.md` | `level_0/codelab.ar.md` | ✅ shipped |
| Pre-workshop guide | `PREWORK.md` | `PREWORK.ar.md` | 🚧 in progress |
| Levels 1–5 (READMEs + codelabs) | `level_N/README.md` etc. | `level_N/README.ar.md` etc. | ❌ planned |
| Post-workshop | `POST_WORKSHOP.md` | `POST_WORKSHOP.ar.md` | ❌ planned |
| Master deck | `slides/AdkClaw_Workshop.marp.md` | `slides/AdkClaw_Workshop.ar.marp.md` | ❌ planned |

## How to translate

Two paths. Pick per-file based on cost/quality trade-off.

### Path A — Manual (high quality, slow)

A native Arabic-speaking technical reviewer translates and adapts. Adapts, not just translates: technical terms (function calling, event loop, OIDC) often stay in English even in Arabic prose; dates flip RTL; examples may need region-specific adjustment (Telegram + WhatsApp coverage in Arab markets, GCP regions, etc.).

This is what we use for Level 0 (the highest-stakes content — first impression).

### Path B — Gemini-assisted draft + human review (faster, ~80 % quality)

Use the `scripts/translate.sh` helper. It calls Gemini Pro with a translator system prompt, drafts the Arabic, then a human reviews the diff before merging.

```bash
# One file at a time — review every output
./scripts/translate.sh level_1/README.md level_1/README.ar.md
./scripts/translate.sh level_1/codelab.md level_1/codelab.ar.md
# ... etc
```

The script keeps technical terms in English (function calling, OIDC, etc.), preserves all code blocks verbatim, and flips RTL where appropriate. Human reviewer:

- Verifies code blocks are untouched
- Verifies technical terms stayed in English
- Checks tone (Arabic dev community uses MSA + light dialect; the agent's voice should match)
- Fixes Gemini's occasional over-formality

## File naming convention

- `<file>.md` — English (default; what `[link](file.md)` from other docs hits)
- `<file>.ar.md` — Arabic version, RTL, MSA + light dialect
- Other languages: `<file>.es.md`, `<file>.fr.md`, etc.

## Cross-linking

At the top of every translated file, add a language switcher:

```markdown
> 🌐 **Language:** [English](README.md) · **العربية**
```

In the English version, link to the Arabic:

```markdown
> 🌐 **اللغة:** [English](README.md) · [العربية](README.ar.md)
```

Both versions live next to each other in the repo. No separate `i18n/` tree (avoids merge conflicts when content is updated).

## Update discipline

When the English version changes, the Arabic version goes stale. Two options:

1. **Mark stale at top of file** with a banner: `> ⚠️ هذه النسخة العربية متأخرة عن النسخة الإنجليزية بتاريخ YYYY-MM-DD.`
2. **Re-translate** the changed sections using `translate.sh` and merge a follow-up PR.

The `translate.sh` script supports a `--diff-mode` flag (planned) that takes only the diff vs. the previous English commit and translates just the changed lines.

## Trainer cohorts in Arabic

Per `strategy/TRAIN-THE-TRAINER.md`: a trainer delivering an Arabic-language cohort needs:

- Native or near-native Arabic
- Both the English and Arabic codelab versions reviewed before the cohort
- An Arabic-speaking TA in the support channel

Codelab version control is in English; translations follow the canonical English source.

## Status table for Cohort 1

By Cohort 1 launch, target completion:

- ✅ Level 0 (Arabic + English) — shipped
- 🎯 Level 1 README + codelab (Arabic, Gemini-drafted, human-reviewed)
- 🎯 PREWORK.md (Arabic)
- ❌ Levels 2–5 — defer to Cohort 2 (Arabic students follow the English codelab; spoken delivery is in Arabic)

This is honest staging: ship what's reviewable to high quality, don't ship rough machine-translated content that hurts the brand.
