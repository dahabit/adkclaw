---
date: 2026-05-08
context: Level 5 hardening
status: approved
---

# Decision: BudgetGuard FATAL on missing config (no silent default)

## Why
A silent default of 500 K tokens/day hides missing configuration. The first time we ship without `DAILY_TOKEN_BUDGET` set, we find out at 3 AM with a $400 bill. Configuration is part of the program; missing config is a structural bug, not a runtime quirk.

## Implementation
`assertDailyTokenBudget()` runs at startup, throws if env unset or below 1000-token floor. Daemon refuses to come up.

## Trade-offs
- Slightly more friction for first-time setup (must read the error and set the env var)
- Worth it: errors at startup are 100x cheaper than errors at runtime

## Reverted if
We ever ship a managed-config mode where the env var is provisioned externally and the validation duplicates work — none yet.
