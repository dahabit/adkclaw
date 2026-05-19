# AdkClaw Examples

Copy-paste recipes for the **finished** agent — for people who just want to
*use* AdkClaw, not build it in the workshop.

Start the agent first:

```bash
npm install
npm run setup     # name your agent, paste your Gemini API key
npm start         # boots on http://localhost:3000
```

Then run any example below.

| File | What it shows |
|------|---------------|
| `quickstart.sh` | Health, status, and a chat round-trip — all via `curl` |
| `chat-client.mjs` | A minimal programmatic client (native `fetch`, no deps) |

Full endpoint reference: [`../docs/api.md`](../docs/api.md).
What the agent can actually do: [`../docs/capabilities.md`](../docs/capabilities.md).
