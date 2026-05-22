# Level 1 — Resources

Curated links + ideas for students AND instructors. Students read this to go deeper; instructors link from here when out of session time on a tangent.

---

## Reference docs

### Google Agent Development Kit (ADK)
- [ADK official docs](https://google.github.io/adk-docs/) — the primary source of truth for the framework
- [ADK GitHub](https://github.com/google/adk-python) — Python reference (TypeScript ADK is `@google/genai`)
- [ADK Foundation Codelab](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) — Google's introduction codelab; complementary to L1
- [Building ADK Agents with Skills and Tools (Cloud Next 2026)](https://codelabs.developers.google.com/next26/dev-keynote/building-agents-with-skills) — the new Skills + MCP pattern

### Gemini API
- [Gemini API quickstart](https://ai.google.dev/gemini-api/docs/quickstart) — get a key, send your first request
- [Function calling guide](https://ai.google.dev/gemini-api/docs/function-calling) — the mechanism powering tool use in L1
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/grounding) — what `web_search` uses under the hood
- [Gemini 2.5 model card](https://ai.google.dev/gemini-api/docs/models) — Pro vs Flash tradeoffs

### Cloud Shell + GCP basics
- [Cloud Shell tutorial](https://cloud.google.com/shell/docs/launching-cloud-shell) — what is it, how to open
- [gcloud CLI cheat sheet](https://cloud.google.com/sdk/docs/cheatsheet) — common commands
- [Google Cloud Free Tier](https://cloud.google.com/free) — what's covered by your $300 credit

### TypeScript reference
- [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/intro.html) — official
- [Effective TypeScript by Dan Vanderkam](https://effectivetypescript.com/) — most-recommended deep-read

---

## Sister codelabs from Google

These are Google's official codelabs that overlap with each AdkClaw level. Use them for an alternate angle on a concept.

| For our pillar | Google codelab | Why |
|----------------|----------------|-----|
| Brain + agent loop | [Build agents with ADK: The Foundation](https://codelabs.developers.google.com/devsite/codelabs/build-agents-with-adk-foundation) | Same loop, in Python |
| Tools | [Building ADK Agents with Skills and Tools](https://codelabs.developers.google.com/next26/dev-keynote/building-agents-with-skills) | The MCP-tools direction |
| Memory | [Building Stateful and Personalized Agents with ADK](https://codelabs.developers.google.com/codelabs/agent-memory/instructions) | 6 levels of memory progression |
| Sub-agents | [Build Multi-Agent Systems with ADK](https://codelabs.developers.google.com/codelabs/production-ready-ai-with-gc/3-developing-agents/build-a-multi-agent-system-with-adk) | Sequential / Loop / Parallel agents |
| Sub-agents (real example) | [Aidemy: Multi-Agent Teaching Assistant](https://codelabs.developers.google.com/aidemy-multi-agent/instructions) | Pub/Sub event-driven pattern |
| Multimodal + RAG | [Survivor Network](https://codelabs.developers.google.com/codelabs/survivor-network/instructions) | Disaster response — multimodal, Graph RAG, Memory Bank |
| Cloud-deploy | [Cloud Run Ultimate Guide](https://codelabs.developers.google.com/next26/ultimate-cloud-run-guide) | Cloud Run + VPC + Secret Manager + ADK |
| Multi-agent at production | [Multi-agent App with AlloyDB (kitchen renovation)](https://codelabs.developers.google.com/multi-agent-app-with-adk) | Real workflow with database |
| Debugging agents | [Debugging Agents at Scale (Cloud Next 2026)](https://codelabs.developers.google.com/next26/dev-keynote/debugging-agents) | Cloud Observability + EventCompaction |

**Tip for instructors**: when a student asks "what if I want X?", search this list. If a Google codelab covers it, link there instead of re-explaining.

---

## Sample prompts to demo

Use these in your live intro-demo agent. Each is proven to produce a great visual outcome.

### Code-generation track (matches Ahmed's existing demo)
```
build me a calculator app in Flutter
build me a landing page for a coffee shop in HTML + Tailwind
add a dark mode toggle to the calculator
turn the landing page into a Next.js app with a working contact form
```

### Research track (preview of what L2 enables)
```
What's the latest stable Flutter version, and what changed since 3.27?
Compare Cloud Run pricing vs App Engine for a 1k-req/day workload.
Who is on the Vertex AI agent platform team at Google?
```

### Multi-agent track (preview of L3 + Part 2 Multi-Agent Orchestrator)
```
Plan a 3-day trip to Cairo for two — flights, hotel, food, budget $1500.
Find the top 5 open issues in the @google/genai repo and group them by area.
Schedule a weekly review of the AdkClaw cohort fleet, ping me on regressions.
```

### Memory track (preview of L2)
```
Remember I prefer Riverpod over Bloc for new Flutter projects.
What database did I tell you to default to last week?
What were the 3 decisions we made in our last session?
```

---

## Inspiration — articles, talks, tweets

### The "why" behind autonomous agents
- ["The Bitter Lesson"](http://www.incompleteideas.net/IncIdeas/BitterLesson.html) — Rich Sutton's essay on why scale + general methods win
- ["Agents"](https://lilianweng.github.io/posts/2023-06-23-agent/) — Lilian Weng (OpenAI) — the canonical agent overview, still relevant
- [Anthropic's "Building effective agents"](https://www.anthropic.com/research/building-effective-agents) — patterns and antipatterns for agent design

### Practical agent engineering
- [Latent Space: "Agent Stack: 2026 Edition"](https://www.latent.space/) — yearly state-of-the-art roundup
- [Sundar Pichai's keynote at Cloud Next 2026](https://cloud.google.com/blog/topics/google-cloud-next/google-cloud-next-2026-wrap-up) — context for ADK 2.0 + A2A protocol
- [Agent Sandbox announcement (Cloud Next 2026)](https://cloud.google.com/blog/products/ai-machine-learning/agent-sandbox) — the pattern Ahmed's intro demo uses

### Voices to follow
- [@oriolvinyalsml](https://x.com/oriolvinyalsml) — Google DeepMind, agents
- [@LangChainAI](https://x.com/LangChainAI) — competing framework, useful as foil
- [@dahabdev](https://x.com/dahabdev) — Ahmed (this course's author) for AdkClaw updates

---

## Deep dives — for students who want to go beyond Level 1

### After this codelab, before Level 1
- Read [`docs/teaching-guide.md`](https://github.com/dahabit/adkclaw/blob/main/docs/teaching-guide.md) — the deep "why" reference
- Read [`docs/tech-stack.md`](https://github.com/dahabit/adkclaw/blob/main/docs/tech-stack.md) — full dependency audit with rationale per package
- Read [`docs/capabilities.md`](https://github.com/dahabit/adkclaw/blob/main/docs/capabilities.md) — what the finished agent can do (and what it can't)

### After Level 1, want more on agent loops
- [Anthropic's "Tool use overview"](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — same patterns, different vendor
- [Google's MCP server starter](https://github.com/modelcontextprotocol/servers) — when you outgrow tool authoring and want discovery

### After Level 4, want to ship to production
- [Building reliable LLM-powered apps (Cloudflare)](https://blog.cloudflare.com/) — failure modes
- [Vercel AI SDK](https://sdk.vercel.ai/) — alternative agent-on-edge runtime

---

## "If a student asks X..."

Quick reference for instructors during Q&A.

| Question | Point them to | One-liner answer |
|----------|---------------|------------------|
| "How do I add MCP?" | [MCP servers repo](https://github.com/modelcontextprotocol/servers) | "MCP is for tool *discovery*. We teach tool *authoring* here. Add MCP after L4 as an exercise." |
| "Can I use Claude / GPT-4?" | [`docs/tech-stack.md`](https://github.com/dahabit/adkclaw/blob/main/docs/tech-stack.md) | "Yes — swap `@google/genai` calls. Out of scope for the workshop. Patterns are identical." |
| "What's the production version of this?" | Vertex AI Agent Engine docs | "[Agent Engine](https://cloud.google.com/products/gemini-enterprise-agent-platform) is Google's managed runtime. After L4 you can move there." |
| "Can the agent learn / fine-tune?" | Gemini fine-tuning docs | "Different problem. Memory and skills (L2) cover most of what people mean by 'learn'. Fine-tuning is a Part 2 stretch topic." |
| "Is this safe to put in front of users?" | L3 self-healing + permission tiers | "Yes once you complete L3 (recovery pyramid) and L4 (Cloud Logging + alerts). The `permission` field on tools is your second guardrail." |
| "How does this compare to LangGraph?" | LangChain blog on multi-agent | "LangGraph hides the loop. Our L1 is the loop. After L1 you'll understand LangGraph in 30 seconds." |
| "Do you have an Arabic version?" | Status: planned post-Cohort 1 | "Coming after our first cohort. Same structure, Arabic prose." |
| "How do I contribute?" | [Repo issues](https://github.com/dahabit/adkclaw/issues) | "Open an issue or a PR. We accept contributions under Apache 2.0." |
| "Is this the same as ChatGPT's 'Custom GPTs'?" | Comparison in `docs/teaching-guide.md` | "Custom GPTs are Rung 4 (tool-using, no autonomy). AdkClaw is Rung 5 (autonomous)." |
| "Will this work for non-English languages?" | Gemini multilingual docs | "Yes — Gemini is multilingual. Your `IDENTITY.md` and `SOUL.md` can be in any language." |

---

## Cohort fleet view

Once your students register at `adkclaw.dev/join/<event>`, watch them light up here:

**[adkclaw.dev/e/<your-event>/fleet](https://adkclaw.dev/e/sandbox/fleet)**

Use the fleet view as:
- **A motivator**: "Look — Aisha just hit Level 1. Yusuf is on Level 3."
- **A diagnostic**: "Three students still on Level 1 — let's pause and check what's stuck."
- **A celebration**: when L4 lights up, the gold beacon is the cohort's collective win.

---

## Privacy + ethics notes for instructors

When you teach this course in a public setting:

- **Don't show your real Telegram bot token on screen.** Use a fresh token for the workshop, revoke after.
- **Don't show your real Gemini key.** Same — fresh key, revoke after.
- **Don't open `.env` files in your editor while screen-sharing.** Use a placeholder file.
- **The intro demo agent**: if it has access to your real data (Calendar, Drive), use a sandboxed copy for the workshop, not your production agent.
- **Student data**: students self-report avatars and usernames. Don't ask for emails / phone numbers in any data collection.

---

## Where to put feedback

Spotted a missing resource? An outdated link? A better way to explain something?

Open an issue: [github.com/dahabit/adkclaw/issues](https://github.com/dahabit/adkclaw/issues) with the label `level-0`.

Or DM Ahmed: [@dahabdev on X](https://x.com/dahabdev).

This document is meant to grow with the course. Cohort 1 will add 5 questions to the "If a student asks X" table. By Cohort 5 it'll be a complete instructor handbook.
