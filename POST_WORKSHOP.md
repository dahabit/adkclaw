# Post-Workshop — What Now?

You finished. Your agent is on Cloud Run, reachable from Telegram, remembering you across reboots, with sub-agents and self-healing. That's a real artifact. Here's what to do with it.

## The first 24 hours

1. **Verify it's actually alive.** Send your bot a message. Then close the laptop, walk away, come back tomorrow, and send another. If it answers, you've shipped a 24/7 service.
2. **Tell someone.** Drop a link in the cohort channel, post a screenshot, share the public URL. The conversation around what your agent does is half the value of the workshop.
3. **Pick a name and a tagline.** Update `IDENTITY.md` and `SOUL.md` so the agent feels like *yours*, not the workshop default.

## Keep it cheap (or free)

Cloud Run scales to zero between requests, so an idle agent costs nothing. To stay there:

```bash
# Cap min-instances at 0 (default for new services)
gcloud run services update adkclaw \
  --region=$REGION --min-instances=0

# Set a hard daily token budget in your agent
echo 'DAILY_TOKEN_BUDGET=200000' >> .env
```

Watch your spend in [console.cloud.google.com/billing](https://console.cloud.google.com/billing). Set a budget alert at a low threshold — any overshoot means a bug, not a feature.

## Decommission cleanly (if you want to)

You can take everything down later with one script:

```bash
./scripts/graduate-cleanup.sh
```

It deletes the Cloud Run service, drops Firestore collections, removes the GCS bucket, and revokes the Telegram webhook — leaving your account clean.

If you'd rather keep the agent alive but stop building, set `--min-instances=0` and walk away. It costs nothing while idle.

## Get your certificate

When your agent registers Level 4 completion at [adkclaw.dev](https://adkclaw.dev), the platform issues a verifiable graduation certificate at `adkclaw.dev/u/<your-username>/certificate`. Share it on LinkedIn or wherever recruiters look — the verification link proves you actually shipped the agent, not just clicked through a tutorial.

## Take it further — extension projects

Three optional projects, ranked by difficulty. Pick one (or none — finishing is also a complete experience).

| Project | Difficulty | What you'll learn |
|---|---|---|
| [`extensions/slack-channel/`](extensions/slack-channel/README.md) | Medium | Plug a second channel into the same agent — Slack instead of Telegram |
| [`extensions/researcher-rag/`](extensions/researcher-rag/README.md) | Hard | Embed your own PDFs/docs into Vertex AI Vector Search; agent answers from your private corpus |
| [`extensions/voice-tutor/`](extensions/voice-tutor/README.md) | Medium | Bidirectional voice chat with Gemini Live API |
| [`extensions/mcp-server/`](extensions/mcp-server/README.md) | Medium | Expose your agent's tools to Claude Desktop, Cursor, and other MCP-aware clients |

Each scaffold has a README, a starter, two passing tests, three failing tests you fix to graduate, and clear success criteria.

## 30-day follow-up rhythm

Week-by-week reminders the cohort facilitator will drop in the alumni channel:

| When | Drop |
|---|---|
| Day 0 | Congrats + cert link + alumni channel invite |
| Day +7 | Slack-adapter scaffold released — try it this week |
| Day +14 | RAG scaffold released — index your own docs |
| Day +21 | Cost reality check + decommission script — keep your agent or kill it cleanly |
| Day +28 | "Contribute back" — three issues tagged `alumni-first` ready for your first PR |
| Day +30 | NPS + testimonial survey (optional, two minutes) |

## Contribute back

Three tiers, pick one:

1. **Skill author**: write a markdown skill (`workspace/skills/<name>.md`) that teaches your agent to do something specific — summarize PRs, draft an interview reply, plan a trip. Submit as a PR — gets shipped to the next cohort's bank.
2. **Tool author**: add a new `AgentTool` (50–100 LoC + tests). Calendar reads, Slack search, Notion fetch — pick something the workshop doesn't already have.
3. **Extension co-maintainer**: take ownership of one of the extension scaffolds, review PRs from the next cohort, get your name in the README.

Look for issues tagged `alumni-first` in [github.com/dahabit/adkclaw/issues](https://github.com/dahabit/adkclaw/issues).

## Spotlight your work

If you build something cool on top of your agent, tell us — we feature alumni agents on `adkclaw.dev/gallery`. Drop a link in the alumni channel; the GDE team reviews monthly.

## Decommission checklist

If you want to start over from scratch (or just remove all traces):

- [ ] `./scripts/graduate-cleanup.sh` — deletes Cloud Run + Firestore + GCS + webhook
- [ ] Revoke Gemini API key in [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- [ ] Revoke Telegram bot token via `/revoke` to [@BotFather](https://t.me/BotFather)
- [ ] `gcloud projects delete YOUR_PROJECT_ID` (only if the project was workshop-only)
- [ ] Local: `rm -rf adkclaw/` and `~/.adkclaw/`

## You shipped a real thing

A chatbot answers. You built something that *acts* — across time, channels, and delegation. The agent loop, memory model, recovery pyramid, sub-agent orchestration, Cloud Run discipline you just learned scale to anything you want to build next.

Tell us what you build. Open an issue, tag a maintainer, post in the alumni channel. The next cohort starts in a few weeks.
