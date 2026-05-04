# What Your Agent Can Do

A practical tour of every capability built into your agent — written so you can hand the file to a student or beta tester and they'll know exactly what to try.

> **Quick setup**: `bin/adkclaw bg` (background) or `bin/adkclaw start` (foreground). Open the dashboard with `bin/adkclaw open`. Stop anytime with `bin/adkclaw stop`.

---

## The 21 tools your agent has

Your agent isn't a chatbot — it's an **operator** with hands. Here's what those hands can do:

| Tool | What it does | Try saying… |
|------|-------------|------------|
| `web_search` | Google Search grounding via Gemini | *"What happened in tech today?"* |
| `web_fetch` | Pull a URL → markdown | *"Summarize https://flutter.dev/docs"* |
| `browser_fetch` | Render JS-heavy pages with Playwright | *"Get the live data from this dashboard URL"* |
| `browser_screenshot` | Visit a page, screenshot it | *"Screenshot the homepage of github.com"* |
| `browser_pdf` | Convert a webpage to PDF | *"Save flutter.dev/docs as a PDF"* |
| `filesystem` | Read/write/list inside `workspace/` | *"List my workspace"*, *"Read my IDENTITY.md"* |
| `shell` | Run shell commands (asks first) | *"Show me running processes"* |
| `text_create` | Write a markdown/text file | *"Write a 3-section report on RAG"* |
| `presentation_create` | Build a Marp slide deck | *"Make a 5-slide deck on Google ADK"* |
| `pdf_create` | Generate a PDF document | *"Generate a PDF brief: 'What is an autonomous agent?'"* |
| `code_fix` | Read error → propose & apply fix → verify | *"Fix the bug in workspace/output/script.js"* |
| `memory_save` | Persist a fact / decision / project / person | *"Remember I use Riverpod for Flutter"* |
| `memory_recall` | Search the memory bank | *"What do you know about my preferences?"* |
| `daily_append` | Add to today's daily note | *"Note: had a productive session"* |
| `load_skill` | Load a markdown skill from `workspace/skills/` | *"Use the research skill to look into X"* |
| `list_skills` | List available skills | *"What skills do you have?"* |
| `cron_add` | Schedule a recurring or one-time job | *"Every day at 9 a.m., check Flutter news"* |
| `cron_remove` | Remove a scheduled job | *"Remove the Flutter news job"* |
| `cron_list` | List all scheduled jobs | *"Show my schedule"* |
| `message_user` | Proactive delivery (used by cron/heartbeat) | *(triggered automatically)* |
| `spawn_agent` + 4 profiles | Delegate work to a specialist sub-agent | *(see below)* |

---

## Specialized sub-agents (the agent's "team")

When a task is big or specialized, your agent **spawns a teammate** in an isolated session. Each profile uses cheaper/faster Flash unless the task genuinely needs Pro.

| Profile | Mental model | When it spawns |
|---------|-------------|---------------|
| **SearchAgent** | The fast-fingers researcher | Quick web searches, fact lookups |
| **ResearcherAgent** | The investigative journalist | Deep, multi-step research with citations |
| **CommunicatorAgent** | The diplomat | Agent-to-agent (A2A) communication, message reformatting |
| **CoderAgent** | The pair programmer | Read-edit-test loops on code |
| **ad-hoc** | The pinch-hitter | Anything generic |

**Try this**: *"Research the top 3 AI agent frameworks in 2026 and save the key findings to my memory bank."*

You'll see your agent spawn a `ResearcherAgent`, do multi-step web work, then call `memory_save` to write the results. Open `http://localhost:3000/` — you'll see the sub-agent session appear live.

---

## The "wow moments" to demo to students

These are the moments where students go *"wait, it can do that?"* — pick 3-4 for your live demo.

### 1. "Remember this" — cross-session memory

```
You: Remember I prefer SQLite over Postgres for v1 projects.
Bot: Got it — saved to bank/decisions/. Noted, Ahmed. ✓

# Restart the daemon (bin/adkclaw restart)

You: What database do I prefer for v1?
Bot: SQLite over Postgres. You told me last time.
```

The agent **wrote a markdown file to disk**, survived a restart, and recalled it. Show students `cat workspace/bank/decisions/*.md` — they'll see the actual file.

### 2. "Make me a slide deck" — content creation

```
You: Make me a 5-slide deck about why autonomous agents matter, for developers.
Bot: Done. workspace/output/agent-deck-2026-05-04.md. Render it with:
     npx @marp-team/marp-cli@latest workspace/output/agent-deck-2026-05-04.md
```

The agent wrote a real Marp markdown file. One command renders it to HTML/PDF/PPTX.

### 3. "Wake me up at 9 a.m." — scheduled autonomy

```
You: Every weekday at 9 a.m., check Flutter news and ping me only if something new shipped.
Bot: Scheduled. Job ID: cron_a8f2. I'll respect quiet hours (no pings before 7 a.m.).
```

`bin/adkclaw status` will show the cron job. At 9 a.m. tomorrow it'll fire — even if you're not talking to the agent. The bank-backed dedup means you only get pinged on **new** items.

### 4. "Fix this bug" — code repair

```
You: Read workspace/output/script.js, run it, fix any errors, and save the working version.
Bot: Found a TypeError on line 12. Patched it (was missing `await`). Tested — runs clean. ✓
```

This uses `code_fix` which wraps Gemini CLI + filesystem + shell into a read-edit-test loop.

### 5. "Research and report" — multi-tool chain

```
You: Find 3 recent papers on agentic memory systems, summarize each, and save them as a PDF.
Bot: ✓ workspace/output/agentic-memory-papers-2026-05-04.pdf (3.2MB)
     Spawned ResearcherAgent → 3 parallel web_searches → web_fetch on each → pdf_create.
     Tools called: 11. Tokens: 12,840. Took 28s.
```

One sentence triggered six tool types in sequence.

### 6. "Give it a nickname" — personality

```
You: Can I name you Dudu?
Bot: Dudu! I love it. Dudu it is. ❤️ What's our first task together?
```

(After your `IDENTITY.md` / `SOUL.md` updates — yes, this is the fix you just shipped.)

### 7. "Teach yourself a new skill" — runtime extensibility

```
You: Save the research workflow we just used as a skill so you can reuse it.
Bot: Done — workspace/skills/research-workflow.md. Next time you say 'research X',
     I'll follow these exact steps.
```

The agent wrote a markdown skill file. Restart the daemon, and the system prompt now lists `research-workflow` as an available skill — without redeploying any code.

### 8. "Show me everything" — admin dashboard

```bash
bin/adkclaw open    # opens http://localhost:3000/
```

Live dashboard auto-refreshes every 8 seconds: active sessions, total tokens, channel breakdown, uptime. Perfect for the demo screen behind you.

---

## Always-on operation (24/7 like OpenClaw)

You no longer need to babysit `npm run dev`. Three ways to run forever:

### Option 1: Background (simplest)

```bash
bin/adkclaw bg          # starts in nohup background
bin/adkclaw status      # check it's alive
bin/adkclaw logs        # tail data/adkclaw.log
bin/adkclaw stop        # when you want to stop
```

Survives terminal close. Restart on reboot? Add this to your shell rc:
```bash
[ -f ~/agents/adkclaw/data/adkclaw.pid ] || ~/agents/adkclaw/bin/adkclaw bg
```

### Option 2: pm2 (survives reboots automatically)

```bash
npm i -g pm2
bin/adkclaw pm2-start
pm2 startup     # follow the printed instruction once
pm2 save        # persists across reboots
```

Now your agent is genuinely 24/7. After OS reboot, pm2 brings it back automatically.

### Option 3: systemd (Linux servers)

```bash
sudo cp systemd/adkclaw.service /etc/systemd/system/
sudo systemctl enable --now adkclaw
journalctl -fu adkclaw
```

### Make `adkclaw` available everywhere on your machine

```bash
# One-time
echo 'export PATH="$HOME/agents/adkclaw/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Now from anywhere:
adkclaw status
adkclaw chat
adkclaw open
```

Or use the npm-link path (uses compiled `dist/`):
```bash
npm run link    # = npm run build && npm link
adkclaw check   # globally available
```

---

## What's surprising about all this

- **5,300 lines of TypeScript** wraps the SDK and gives you all of the above.
- The agent's **entire memory** lives as markdown files you can `cat`, `grep`, and `git diff`.
- A new capability = **drop a `.md` file in `workspace/skills/`**. No redeploy.
- The agent **never crashes** — the recovery pyramid (retry → fallback → degrade → escalate) handles every failure tier.
- One agent serves **Telegram + CLI + HTTP** simultaneously. Same memory, same brain.

---

## Common student demos (in order of jaw-drop)

1. **Cross-session memory** — "Remember…" → restart → "What did I tell you?"
2. **Scheduled monitoring** — "Every morning at 9, check X" → see cron persist in SQLite
3. **Sub-agent spawn** — "Research X deeply" → admin dashboard shows the child session
4. **Skill self-creation** — "Save what we just did as a skill" → student opens the new `.md` file
5. **Self-healing** — disable internet, ask for web search → watch the recovery pyramid in logs
6. **Admin dashboard** — open it on a second monitor; everything is live and observable

When students ask *"how is this so simple?"* — the answer is in `docs/teaching-guide.md`. It's all 5,300 lines, all readable.
