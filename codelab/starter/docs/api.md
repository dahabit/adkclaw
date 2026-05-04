# AdkClaw HTTP API

AdkClaw exposes a clean REST API for managing agent sessions, running chat interactions, and inspecting audit trails. The HTTP server listens on `localhost:3000` (default) and serves Telegram webhooks, CLI REPL requests, and programmatic clients alike.

## Authentication

Currently no authentication. Access is **localhost-only** — the server does not expose a public IP. Future deployments should run behind a reverse proxy (nginx/Caddy) with mutual TLS or API key validation.

## Session Keys

Session keys uniquely identify a conversation and are formatted as `<channel>:<senderId>`:

- `telegram:5025183377` — Telegram user with ID 5025183377
- `cli:local` — Local CLI user
- `http:client-abc` — HTTP client identifier

The channel identifies the source (telegram, cli, http). The senderId is a string uniquely identifying the user within that channel.

## Endpoints

### GET /api/health

Lightweight health check. Returns immediately.

**Response:**
```json
{
  "ok": true
}
```

**Curl:**
```bash
curl http://localhost:3000/api/health
```

---

### GET /api/status

Returns runtime status: agent name, active sessions, token usage, uptime.

**Response:**
```json
{
  "ok": true,
  "uptimeSec": 3600,
  "agentName": "Aria",
  "defaultModel": "gemini-2.5-pro",
  "activeSessionCount": 2,
  "totalSessionCount": 15,
  "totalTokensAllTime": 48290,
  "sessionsByChannel": {
    "telegram": 1,
    "cli": 1
  },
  "sessions": [
    {
      "key": "telegram:5025183377",
      "channel": "telegram",
      "totalTokens": 2100,
      "lastMessageAt": 1746304400000
    }
  ]
}
```

**Curl:**
```bash
curl http://localhost:3000/api/status
```

---

### POST /api/chat

Send a message to the agent and receive a response. The agent runs the full loop: think → tool calls → observe → respond.

**Request Body:**
```json
{
  "sessionKey": "cli:local",
  "message": "research the latest Gemini models",
  "senderId": "local",
  "channel": "http",
  "target": "cli:local"
}
```

- `sessionKey` (required): Unique session identifier
- `message` (required): User input
- `senderId`, `channel`, `target` (optional): Default to HTTP values if omitted

**Response:**
```json
{
  "text": "Here's what I found...",
  "toolCallCount": 2,
  "tokensUsed": 845,
  "durationMs": 1200,
  "finishReason": "completed"
}
```

- `finishReason`: `completed` | `max_rounds` | `error` | `cancelled` | `budget_exceeded`

**Errors:**
- `400` — missing `sessionKey` or `message`
- `500` — agent runtime error

**Curl:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionKey": "cli:local",
    "message": "hello",
    "senderId": "local",
    "channel": "http"
  }'
```

---

### GET /api/sessions

List all sessions (active and archived, limited to 200).

**Response:**
```json
[
  {
    "key": "telegram:5025183377",
    "channel": "telegram",
    "senderId": "5025183377",
    "createdAt": 1746300000000,
    "updatedAt": 1746304400000,
    "lastMessageAt": 1746304400000,
    "model": "gemini-2.5-pro",
    "totalTokens": 2100,
    "isArchived": false
  }
]
```

**Curl:**
```bash
curl http://localhost:3000/api/sessions
```

---

### GET /api/sessions/:key

Retrieve a session and its full message history (up to 500 messages).

**Response:**
```json
{
  "session": { /* Session object */ },
  "messages": [
    {
      "id": "msg-001",
      "sessionKey": "cli:local",
      "role": "user",
      "content": "hello",
      "tokens": 10,
      "createdAt": 1746304400000
    },
    {
      "id": "msg-002",
      "sessionKey": "cli:local",
      "role": "assistant",
      "content": "Hi there!",
      "toolCallCount": 0,
      "tokens": 20,
      "createdAt": 1746304401000
    }
  ]
}
```

**Errors:**
- `404` — session not found

**Curl:**
```bash
curl http://localhost:3000/api/sessions/cli:local
```

---

### DELETE /api/sessions/:key

Archive a session (soft delete; data remains in the database).

**Response:**
```json
{
  "ok": true
}
```

**Curl:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/cli:local
```

---

### GET /api/audit/:key

Immutable audit dump: full session history, all messages, and the latest compaction checkpoint. Used for compliance and debugging.

**Response:**
```json
{
  "session": { /* Session object */ },
  "messageCount": 42,
  "messages": [ /* All messages, up to 5000 */ ],
  "latestCheckpoint": {
    "summary": "User discussed agent architecture and memory strategies...",
    "created_at": 1746304400000
  }
}
```

**Errors:**
- `404` — session not found

**Curl:**
```bash
curl http://localhost:3000/api/audit/cli:local
```

---

## Error Handling

All errors return JSON with an `error` field:

```json
{
  "error": "session not found"
}
```

HTTP status codes:
- `400` — bad request (missing required fields, invalid input)
- `404` — resource not found
- `500` — server error (agent crash, disk I/O, etc.)

---

## Rate Limits

None enforced at the HTTP layer. Per-session token budgets are enforced by the `BudgetGuard` in the agent runner. Tool round limits default to 15 per message.

---

## Message Roles

Messages in the audit/session history carry a `role` field:
- `user` — human message
- `assistant` — agent response
- `tool` — tool call or result
- `system` — system message (bootstrap, memory, etc.)
