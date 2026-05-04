# src/agent/

## Files
- `runner.ts` — core agent loop (AgentRunner class)
- `budget.ts` — daily token cap enforcement (BudgetGuard class)

## AgentRunner
Wraps the Google ADK agent loop. Key invariants:
- Max 15 tool rounds per turn (`MAX_TOOL_ROUNDS` env, default 15)
- Checks BudgetGuard **before** calling Gemini; returns `finishReason:'budget_exceeded'` if over
- Wraps Gemini calls with `HealingEngine.protect()` — retry → fallback → escalate
- Persists every user message and every assistant reply to SessionStore
- Filters tool declarations by `req.allowedToolNames` when set (used by sub-agent profiles)
- Callbacks: `beforeTurn`, `afterTurn`, `beforeTool`, `afterTool`, `onError` — all optional

## BudgetGuard
- Per-sender daily token cap (reads `DAILY_TOKEN_BUDGET` from config)
- `check(senderId)` → `{ ok, usedToday, budget, refusalText? }`
- Reads `getDailyTokensForSender()` from SessionStore (sums since midnight UTC)
- Budget disabled when `dailyTokenBudget <= 0`

## Adding a new capability to the runner
Don't add it here. Add a tool to `src/tools/` and register it in `src/index.ts`.
