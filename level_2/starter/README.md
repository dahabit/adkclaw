# AdkClaw — Starter Scaffold

**This is what you clone for Level 1.** It's an intentionally-empty canvas — types, config, and the setup wizard are pre-filled so you don't waste time on boilerplate. Every other folder you'll create as you build through the four levels.

---

## What's pre-filled (don't rewrite)

| File / dir | Why it's done for you |
|------------|----------------------|
| `package.json`, `tsconfig.json` | Stable across all levels — no need to evolve them |
| `src/types/` | Shared interfaces so every level uses the same shapes (`AgentTool`, `Session`, `Message`, etc.) |
| `src/config/` | Env + `agent.yaml` loader with validation. Tests pass. |
| `src/cli/setup.ts` | Interactive wizard — names your agent, generates `.env` |
| `src/cli/repl.ts` | Terminal client that POSTs to `/api/chat` (won't work until you build the server in Level 1) |
| `src/cli/index.ts` | The `adkclaw` CLI entrypoint with subcommands |
| `bin/adkclaw` | Convenience wrapper |
| `workspace.example/` | Template for the agent's runtime memory — copy to `workspace/` via the wizard |
| `docs/` | Reference material (teaching guide, capabilities, tech-stack, internals) |
| `.env.example` | All env vars listed with placeholders |
| `agent.yaml.example` | Schema for the agent's public identity |

---

## What's missing (you'll create it)

| Level | Folder you'll create |
|-------|----------------------|
| Level 1 | `src/agent/`, `src/tools/`, `src/sessions/`, `src/channels/`, `src/server/` |
| Level 2 | `src/memory/`, `src/context/compaction.ts`, `src/skills/` |
| Level 3 | `src/multi-agent/`, `src/healing/`, `src/cron/` |
| Level 4 | `Dockerfile`, `src/storage/gcs.ts`, `src/sessions/firestore-store.ts` |

---

## First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Verify the toolchain is healthy
npm run typecheck
npm test                # 12 tests pass (config + setup wizard)

# 3. Run the interactive wizard — names your agent, fills .env
npm run setup

# 4. Run the scaffold
npm run dev
# → 🤖 AdkClaw scaffold v0 — start Level 1 to build the brain
```

**You're done.** Open `level_1/codelab.md` (or [`adkclaw.dev/codelabs/level-1`](https://adkclaw.dev)) to start building the agent loop.

---

## License

Apache 2.0 — see [`LICENSE`](./LICENSE).
