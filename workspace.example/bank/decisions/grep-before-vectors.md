---
date: 2026-03-29
context: Level 2 memory bank
status: approved
---

# Decision: Use grep for memory recall until bank exceeds ~500 entries

## Why
At small scale (<500 entries) grep is faster (10–50 ms vs 500 ms vector round-trip), zero infrastructure, and exact-term matches beat semantic for proper-noun queries (names, IDs, URLs).

## When to migrate to Vertex AI Vector Search
- Bank > ~500 entries
- Queries timing > 100 ms
- Need cross-language semantic match
- Need to retrieve "similar" rather than "exact"

## Trade-offs
- Grep can't find semantically related entries (e.g. "Sara" vs "her boss")
- Acceptable for an agent's working memory; the consolidator promotes only what matters

## Reverted if
Bank performance becomes the bottleneck (track via the audit endpoint).
