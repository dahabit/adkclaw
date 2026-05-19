#!/usr/bin/env bash
# Talk to a running AdkClaw agent over HTTP. Start it first with `npm start`.
set -euo pipefail

BASE="${ADKCLAW_BASE:-http://localhost:3000}"

echo "== health =="
curl -fsS "$BASE/api/health"
echo

echo "== status =="
curl -fsS "$BASE/api/status"
echo

echo "== chat =="
curl -fsS -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionKey": "http:example",
    "message": "In one sentence, what can you do for me?",
    "senderId": "example",
    "channel": "http"
  }'
echo
