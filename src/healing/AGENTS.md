# src/healing/

## Files
- `engine.ts` — HealingEngine: retry / fallback / protect
- `classifier.ts` — classifyError → ClassifiedError
- `types.ts` — error types

## Recovery pyramid (never crashes)
```
timeout / network / rateLimit → retry (exp backoff 1s/2s/4s)
serverError              → retry → model fallback (Pro→Flash)
auth / permission / notFound → escalate immediately (no retry)
```

## HealingEngine API
- `withRetry(fn, opts)` — retries on retryable errors, respects `retryAfterMs` from rate-limit headers
- `withFallback(primary, fallback, opts)` — runs primary; if it fails retryably, runs fallback and returns `{ usedFallback: true }`
- `protect(primary, fallback, opts)` — `withRetry` wrapping `withFallback`; what AgentRunner uses

## Error classifier (classifier.ts)
- HTTP 401/403 → `auth` / `permission` (never retry)
- HTTP 429 → `rateLimit` (parse `retry-after: Ns`)
- HTTP 5xx → `serverError`
- AbortError → `timeout`
- ENOTFOUND / ECONNRESET → `network`
- Unknown → `unknown` (default: retry once)

## Adding a new recovery strategy
Add a new case in `classifier.ts` switch, then handle the new `ErrorKind` in `engine.ts`.
