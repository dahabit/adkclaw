# Extension — Slack channel adapter

**Difficulty:** Medium · **What you'll learn:** plug a second channel into the same agent.

## Why this matters

Your Level 1–4 agent runs on Telegram. Most teams live in Slack. The same `AgentRunner` should speak both — the channel is just an adapter. By the end of this extension, your agent answers from a Slack DM and from a `@mention` in a shared channel.

## What you'll build

- `src/channels/slack.ts` — Slack adapter that wraps `AgentRunner` (mirrors `src/channels/telegram.ts`)
- `src/server/slack-handler.ts` — Express route that handles Slack's `events.url_verification` + `event_callback` payloads
- Reuse: zero changes to `src/agent/runner.ts`, `src/sessions/store.ts`, or any tool. The agent is channel-agnostic by design.

## Prerequisites

- Completed Levels 1–4 (you have a deployed Cloud Run agent)
- A Slack workspace where you can install custom apps (free Slack workspace works)

## Steps

### 1. Create a Slack app

1. Visit [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch.
2. Pick a name and your workspace.
3. Under **OAuth & Permissions**, add bot scopes: `chat:write`, `app_mentions:read`, `im:history`, `im:read`, `im:write`.
4. Install to workspace. Copy the **Bot User OAuth Token** (`xoxb-...`).

### 2. Add to `.env`

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

### 3. Build the adapter

Mirror `src/channels/telegram.ts`:
- Receive Slack `event_callback` payloads
- Verify the request signature (HMAC against `SLACK_SIGNING_SECRET`)
- Map sender ID → `sessionKey` (e.g. `slack:U123ABC`)
- Call `agentRunner.run(sessionKey, message)`
- Post the reply back via `chat.postMessage`

Hint: Slack expects a `200` response within 3 seconds. Acknowledge first, then process async.

### 4. Wire the route

In `src/server/index.ts`, add an Express route at `POST /api/slack/events` that calls your adapter.

### 5. Set the Event Subscriptions URL

In Slack app settings → **Event Subscriptions** → enable, point at `https://<your-cloud-run-url>/api/slack/events`. Subscribe to `app_mention` and `message.im`.

### 6. Test

- Send a DM to your Slack bot.
- `@mention` your bot in a shared channel.
- Both should route to your `AgentRunner` with isolated session keys.

## Success criteria

- [ ] Bot replies in DM
- [ ] Bot replies on `@mention` in a channel
- [ ] Sessions are isolated per Slack user (DM history doesn't leak between users)
- [ ] All existing Telegram tests still pass
- [ ] Two new tests in `src/channels/slack.test.ts` cover signature verification + session-key mapping

## Stretch

- Threaded replies (use `thread_ts` from the event)
- Rich message formatting (Slack Block Kit)
- File uploads — agent reads PDFs the user shares

## Common pitfalls

| Symptom | Fix |
|---|---|
| Slack 403s your URL verification | Signing-secret check is wrong — return the `challenge` field as plaintext, no JSON wrapping. |
| Bot replies twice | You're processing the event before acknowledging. Send `200` first, queue the work async. |
| `@mention` works, DM doesn't | Missing `im:read` + `im:history` scopes — reinstall the app after adding them. |
