# src/multi-agent/

## Files
- `orchestrator.ts` — spawn logic (MultiAgentOrchestrator)
- `profiles/index.ts` — named profile registry

## MultiAgentOrchestrator
- `spawn({ task, parentSessionKey, profileId?, goalChain? })` → `SpawnResult`
- Creates an **isolated session** (kind='isolated', parentKey=caller's session key)
- Sub-agent sees: profile bootstrap + goalChain framing + identity/memory **only** — never parent history
- Tool calls are restricted to `profile.toolAllowlist` via `allowedToolNames`
- Session is **always archived** in `finally` block — no orphaned sessions
- Concurrent sub-agent cap: 4 (global semaphore in orchestrator)

## Profiles (profiles/index.ts)
| id | model | tools | rounds |
|----|-------|-------|--------|
| search | flash | web_search, web_fetch | 6 |
| communicator | flash | (none) | 1 |
| researcher | pro | web_search, web_fetch, memory_save, memory_recall | 10 |
| coder | pro | filesystem, shell | 12 |

## Adding a new profile
1. Define `AgentProfile` object in `profiles/index.ts`
2. Add to `PROFILES` export map
3. Export a typed spawn tool from `src/tools/spawn.ts`
4. Register tool in `src/index.ts`
