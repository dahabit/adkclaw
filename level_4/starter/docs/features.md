# Agent Features & Test Cases

What your AdkClaw agent can do, and how to test each capability.

---

## How to run tests

**Terminal REPL** (fastest for trying things):
```bash
npm run dev        # window 1 — daemon
npm run chat       # window 2 — REPL
```

**Telegram** — message your bot directly once your numeric ID is in `ALLOWED_SENDERS`.

**HTTP** — direct API calls:
```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionKey":"test:1","message":"hello"}' | jq .text
```

---

## 1. Basic conversation

The agent maintains conversation history within a session.

| Test | Say this |
|------|----------|
| Basic reply | `hello` |
| Follow-up memory | `my name is Dahabit` → then later `what's my name?` |
| Multi-turn reasoning | `I have 3 apples and give 1 away` → `how many do I have?` |

---

## 2. Web search & fetch

| Test | Say this |
|------|----------|
| Current events | `what happened in tech news today?` |
| Specific fact | `what is the current Flutter stable version?` |
| URL content | `summarize this page: https://flutter.dev/docs/release/release-notes` |
| Research | `find me 3 recent articles about Google ADK and summarize each` |

---

## 3. Filesystem tools

The agent reads and writes inside `workspace/`. Path traversal is blocked.

| Test | Say this |
|------|----------|
| Read a file | `read my IDENTITY.md and tell me what it says` |
| Write a file | `create a file called ideas.md with 5 app ideas` |
| List workspace | `list all files in my workspace` |
| Read + summarize | `read MEMORY.md and give me a one-paragraph summary` |

---

## 4. Memory bank

Persistent storage that survives restarts.

| Test | Say this |
|------|----------|
| Save a fact | `remember that I use Riverpod for state management in Flutter` |
| Recall a fact | `what do you know about my Flutter preferences?` |
| Save a decision | `save to memory: we decided to use SQLite over Postgres for v1` |
| Cross-session recall | Restart daemon → `what's in my memory bank?` |
| Daily note | `note down: had a productive session working on the agent` |

---

## 5. Content creation

The agent produces real files in `workspace/output/`.

| Test | Say this | Output |
|------|----------|--------|
| Markdown report | `write a 3-section report on AI agent architectures` | `workspace/output/*.md` |
| Slide deck | `create a 5-slide presentation about Google ADK for developers` | `workspace/output/*.md` (Marp) |
| PDF document | `generate a PDF brief: what is an autonomous agent?` | `workspace/output/*.pdf` |

**Render the slide deck to HTML:**
```bash
npx @marp-team/marp-cli@latest workspace/output/your-deck.md
```

---

## 6. Skills

The agent reads skill files from `workspace/skills/` and uses them as workflows.

| Test | Say this |
|------|----------|
| List skills | `what skills do you have?` |
| Use a skill | `research the latest news about Gemini 2.5` |
| Self-learn | `create a skill file for the research workflow we just used` |

---

## 7. Sub-agents

Spawns specialist agents in isolated sessions.

| Test | Say this | Profile used |
|------|----------|-------------|
| Web research | `research Flutter 3.32 release notes in depth` | `researcher` |
| Quick search | `search for the top 3 AI agent frameworks in 2026` | `search` |
| Code task | `look at workspace/output/ and summarize what's there` | `coder` |
| Reformat | `take my last response and rewrite it as bullet points` | `communicator` |
| Generic | `spawn an agent to: count the files in workspace/` | `ad-hoc` |

---

## 8. Cron & scheduled tasks

Jobs persist in SQLite and survive restarts.

| Test | Say this |
|------|----------|
| One-time reminder | `remind me in 1 minute: check the build output` |
| Recurring job | `every day at 9am, search for Flutter news and save to daily notes` |
| List jobs | `list all scheduled cron jobs` |
| Remove job | `remove the Flutter news job` |

**Verify cron fired:**
```bash
sqlite3 data/adkclaw.db "SELECT job_id, status, fired_at FROM cron_runs ORDER BY fired_at DESC LIMIT 5;"
```

---

## 9. Budget guard

Prevents runaway token spend.

| Test | How |
|------|-----|
| Check usage | `curl http://localhost:3000/api/status | jq .totalTokensAllTime` |
| Check per-session | `curl http://localhost:3000/api/sessions/cli:local | jq .session.totalTokens` |
| Audit trail | `curl http://localhost:3000/api/audit/cli:local | jq .messageCount` |

---

## 10. Self-healing

The agent recovers from transient errors automatically.

| Test | How to observe |
|------|---------------|
| Model fallback | Temporarily set an invalid `DEFAULT_MODEL` → restart → the agent falls back to `FALLBACK_MODEL` |
| Rate limit retry | Make 10+ rapid requests → watch daemon logs for retry backoff messages |
| Error recovery | Kill and restart mid-session → session resumes from SQLite |

---

## 11. Multi-turn tool chains

Complex requests that use multiple tools in one turn.

| Test | Say this | Tools expected |
|------|----------|---------------|
| Research + save | `research Google ADK and save the key facts to my memory bank` | web_search → memory_save |
| Fetch + report | `fetch the Flutter changelog and create a PDF summary` | web_fetch → pdf_create |
| Search + present | `find 5 AI tools launched this week and make a slide deck` | web_search → presentation_create |
| Read + fix | `read workspace/output/ideas.md and improve the wording` | filesystem → text_create |

---

## Debugging checklist

If something doesn't work:

```bash
# 1. Is the daemon running?
curl http://localhost:3000/api/health

# 2. What sessions exist?
curl http://localhost:3000/api/sessions | jq '.[].key'

# 3. What did the last turn produce?
curl http://localhost:3000/api/sessions/cli:local | jq '.messages[-3:]'

# 4. Telegram — did the message arrive?
# Watch daemon logs: look for "[telegram] Rejected message from sender XXXX"
# If you see a rejection, copy the sender ID from the log and add it to ALLOWED_SENDERS

# 5. Full audit dump
curl http://localhost:3000/api/audit/cli:local | jq '{messageCount, finishReason: .messages[-1].metadata}'
```
