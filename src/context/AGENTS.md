# src/context/

## Files
- `manager.ts` — ContextEngine: assembles + caches system prompt
- `compaction.ts` — LLM-summarizes oldest messages at 80% context threshold
- `token-counter.ts` — tiktoken-based token counting

## ContextEngine (manager.ts)
Bootstrap reads workspace files in fixed order:
`IDENTITY.md → USER.md → SOUL.md → AGENTS.md → MEMORY.md → memory/<today>.md → HEARTBEAT.md`
Plus: bank index (one-liner per file in bank/) and skills index.

- Cache key = aggregate `mtime` of all workspace files. Rebuild only when something changes.
- `invalidate()` forces a rebuild on the next call.
- Never call Gemini here. System prompt is assembled from plain file reads only.

## Compaction (compaction.ts)
Fires when message history hits **80%** of the model's context window.

1. Calls `sessions.getLatestCheckpoint()` to find where last compaction ended
2. Takes messages from checkpoint to ~60% of window, sends to Gemini for summarization
3. Preservation rules injected in the compaction prompt: IDs, URLs, file paths, task status, decisions must survive
4. Writes new checkpoint via `sessions.createCheckpoint()`; original messages are **never deleted**

## Token counter (token-counter.ts)
- `countTokens(text)` → number (uses cl100k_base tiktoken encoding)
- Used by compaction to estimate how much history fits
