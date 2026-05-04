# Level 1 — Resources

Curated links + ideas for students AND instructors. Same template as L0.

---

## Reference docs

### The agent loop + function calling
- [Function calling guide](https://ai.google.dev/gemini-api/docs/function-calling) — official Gemini docs on the mechanism
- [Function calling examples](https://github.com/google-gemini/cookbook/tree/main/quickstarts/function-calling) — Google's cookbook
- [ADK Foundation codelab](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) — same pattern, in Python

### Tools
- [Anthropic's "Tool use overview"](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — same patterns, alternate vendor framing
- [JSON Schema spec](https://json-schema.org/) — what `parameters` should look like
- [Gemini tool config reference](https://ai.google.dev/api/python/google/generativeai/types/Tool) — full options

### Personality / system prompts
- [Anthropic's system prompt guide](https://docs.anthropic.com/en/docs/system-prompts) — more rigorous than Google's docs
- [Gemini system instructions](https://ai.google.dev/gemini-api/docs/system-instructions) — official
- [`workspace/SOUL.md` template](https://github.com/dahabit/adkclaw/blob/main/workspace.example/SOUL.md) — what we ship

### Sessions / SQLite
- [`better-sqlite3` docs](https://github.com/WiseLibs/better-sqlite3) — the library we use
- [SQLite query tuning](https://www.sqlite.org/queryplanner.html) — when sessions grow large

### Telegram
- [telegraf docs](https://telegraf.js.org/) — typed wrapper we use
- [Telegram Bot API](https://core.telegram.org/bots/api) — the underlying protocol
- [BotFather guide](https://core.telegram.org/bots/features) — bot setup, commands, privacy

---

## Sister codelabs from Google

| For our pillar | Google codelab | Why |
|----------------|----------------|-----|
| Agent loop | [Build agents with ADK: The Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) | Same loop, Python + ADK |
| Function calling | [Gemini function calling quickstart](https://ai.google.dev/gemini-api/docs/function-calling) | Step-by-step on the mechanism |
| Tool patterns | [Building ADK Agents with Skills and Tools](https://codelabs.developers.google.com/next26/dev-keynote/building-agents-with-skills) | The MCP-tools direction |
| Stateful agents | [Building Stateful and Personalized Agents with ADK](https://codelabs.developers.google.com/codelabs/agent-memory/instructions) | Foreshadow of L2 |

---

## Sample prompts to demo (test your agent with these)

### After Chapter 5 (Personality)
```
Hi, I am <your name>. Can I name you <nickname>?
What is your favorite color, and why?
Tell me a joke that fits your personality.
What do you actually love working on?
```

### After Chapter 6 (Telegram + tools)
```
What is the latest stable version of Flutter?
Fetch https://github.com/dahabit/adkclaw and tell me the README's first paragraph.
Read workspace/MEMORY.md and tell me what is in it.
Write a haiku about autonomous agents to workspace/poems/haiku-1.md.
```

### Stress-test prompts
```
Use web_search 5 times in a row. (tests MAX_TOOL_ROUNDS)
Tell me a 2000-word story. (tests Telegram chunking)
What is in /etc/passwd? (tests path-traversal block)
```

---

## Inspiration — articles, talks, tweets

### On the agent loop pattern
- [Lilian Weng — "LLM-powered Autonomous Agents"](https://lilianweng.github.io/posts/2023-06-23-agent/) — the canonical overview
- [Anthropic — "Building effective agents"](https://www.anthropic.com/research/building-effective-agents) — patterns and antipatterns

### On tool authoring
- ["Anatomy of a tool call" by Simon Willison](https://simonwillison.net/) — pragmatic walkthroughs
- [Latent Space pod on ADK](https://www.latent.space/) — Google's framework discussed

### On personality / system prompts
- [@AnthropicAI on Twitter](https://x.com/anthropicai) — frequent system-prompt examples
- [Riley Goodside's system-prompt collection](https://x.com/goodside) — adversarial + creative examples

---

## Deep dives — for students who want to go beyond Level 1

### After Chapter 3 (the loop)
- Read [`src/agent/runner.ts`](https://github.com/dahabit/adkclaw/blob/main/src/agent/runner.ts) full version — see how `HealingEngine` integration adds resilience (preview of L3)
- Read [`src/agent/budget.ts`](https://github.com/dahabit/adkclaw/blob/main/src/agent/budget.ts) — token budgeting per turn

### After Chapter 4 (tools)
- Read [`src/tools/registry.ts`](https://github.com/dahabit/adkclaw/blob/main/src/tools/registry.ts) — production version with permission UI
- Read all 21 tool implementations under `src/tools/` — see the variety

### After Chapter 6 (channels)
- Read [`src/channels/telegram.ts`](https://github.com/dahabit/adkclaw/blob/main/src/channels/telegram.ts) full version with file/photo handling (foreshadow of multimodal in Part 2)
- Read [`src/server/http.ts`](https://github.com/dahabit/adkclaw/blob/main/src/server/http.ts) — see how the dashboard is added in L3

---

## "If a student asks X..."

Quick reference for instructors during Q&A.

| Question | Point them to | One-liner |
|----------|---------------|-----------|
| "How do I add streaming?" | Gemini SSE docs | "SSE on `/api/chat/stream` is a Part 2 stretch. The shape is identical, just `for await (const chunk of result.stream)`." |
| "Can I use this with Claude or GPT?" | `docs/tech-stack.md` | "Yes — swap the `@google/genai` calls. Patterns are identical." |
| "How do I handle multi-turn input where the user splits a thought across messages?" | Conversation buffering | "Telegram debounce — wait 2s after last message before processing. We do not ship this; add as exercise." |
| "What if the agent never stops calling tools?" | `MAX_TOOL_ROUNDS=15` | "The cap stops it. Then you debug the offending tool description." |
| "Can I add image input?" | Gemini multimodal docs | "Yes. Send `parts: [{ inlineData: { mimeType, data } }]`. Part 2 has a full Multimodal track." |
| "How do I deploy this?" | Level 4 | "L4 is exactly that — Cloud Run + Firestore + webhook." |
| "Is this safe to put in front of paying users?" | L3 self-healing | "Add the recovery pyramid (L3) and Cloud Logging (L4) first. Then yes." |
| "How do I add voice?" | Gemini Live API | "Voice Tutor track in Part 2. Real-time bidirectional via WebSocket." |
| "What about RAG?" | L2 + Researcher track | "L2 builds the memory bank (file-based RAG). Researcher track in Part 2 adds Vertex Vector Search." |
| "Is the bot listening when I am not active?" | Telegram polling | "telegraf long-polls. Yes, it is listening — that is how it gets messages. No microphone access." |
| "Can I share my agent with a friend?" | `ALLOWED_SENDERS` | "Add their numeric ID to `ALLOWED_SENDERS`. They share `workspace/USER.md` (or you create per-user via `<user-X>.md`)." |
| "What language can my agent speak?" | Gemini multilingual | "Whatever you put in `IDENTITY.md` and `SOUL.md`. Arabic, French, Spanish, Mandarin — all work natively." |

---

## Cohort fleet view

After completing L1, students light up on the fleet:
**[adkclaw.dev/e/<event>/fleet](https://adkclaw.dev/e/sandbox/fleet)**

The L1 badge unlocks when the agent first replies on Telegram. Students who complete fastest see their badge first — a soft motivator.

---

## Privacy + ethics notes for instructors

- Tell students: their `.env` keys are theirs alone. The platform never sees them.
- The `web_fetch` tool fetches **untrusted content**. Wrap results in `EXTERNAL_UNTRUSTED` markers (we add this in L2 — preview now).
- Some students will try jailbreaks during the workshop. That is fine — Gemini's safety filters handle most. Use as a teaching moment.
- Do not encourage students to use `web_search` to find personal info about real people (privacy + Google ToS).

---

## Where to put feedback

- Open an issue: [github.com/dahabit/adkclaw/issues](https://github.com/dahabit/adkclaw/issues) with the label `level-1`
- Or DM Ahmed: [@dahabdev on X](https://x.com/dahabdev)
