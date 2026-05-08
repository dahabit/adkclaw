#!/usr/bin/env bash
# AdkClaw — 5-minute environment preflight.
# Run from repo root: ./scripts/preflight.sh
# Prints a green tick or a red cross per check + actionable fix.
# Exits 0 if all required checks pass; 1 otherwise.

set -u
cd "$(dirname "$0")/.." || exit 1

# A value that begins with `your_` is treated as the unset placeholder from
# .env.example (real credentials never start with that prefix).
is_placeholder() { [[ "$1" == your_* ]]; }

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass()  { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; FAILED=$((FAILED+1)); }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }

FAILED=0

echo ""
echo "🤖 AdkClaw — preflight check"
echo "─────────────────────────────"

# 1. Node.js 22+
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 22 ]; then
    pass "1. Node.js $NODE_VERSION (need 22+)"
  else
    fail "1. Node.js $NODE_VERSION — need 22 or newer. Install via: nvm install 22"
  fi
else
  fail "1. Node.js not installed. Install via: https://nodejs.org/ or nvm install 22"
fi

# 2. git
if command -v git >/dev/null 2>&1; then
  pass "2. git $(git --version | awk '{print $3}')"
else
  fail "2. git not installed. Install via: https://git-scm.com/"
fi

# 3. gcloud CLI (Level 4 only)
if command -v gcloud >/dev/null 2>&1; then
  pass "3. gcloud CLI $(gcloud --version 2>/dev/null | head -1 | awk '{print $4}')"
else
  warn "3. gcloud CLI not installed (optional now, required for Level 4). Install: https://cloud.google.com/sdk/docs/install"
fi

# 4. GCP project set
if command -v gcloud >/dev/null 2>&1; then
  PROJECT=$(gcloud config get-value project 2>/dev/null)
  if [ -n "$PROJECT" ] && [ "$PROJECT" != "(unset)" ]; then
    pass "4. GCP project: $PROJECT"
  else
    if [ -n "${GOOGLE_CLOUD_PROJECT:-}" ]; then
      pass "4. GCP project (from env): $GOOGLE_CLOUD_PROJECT"
    else
      warn "4. GCP project not set. Run: gcloud config set project YOUR_PROJECT_ID"
    fi
  fi
else
  warn "4. Skipping GCP project check (gcloud not installed)"
fi

# 5. Gemini API key
if [ -f .env ]; then
  if grep -q '^GEMINI_API_KEY=' .env; then
    KEY=$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
    if [ -z "$KEY" ] || is_placeholder "$KEY"; then
      warn "5. GEMINI_API_KEY in .env is the placeholder. Replace with a real key from https://aistudio.google.com/apikey"
    elif [ ${#KEY} -lt 30 ]; then
      fail "5. GEMINI_API_KEY in .env looks too short (${#KEY} chars). Should be ~39 chars."
    else
      pass "5. GEMINI_API_KEY in .env (${#KEY} chars)"
    fi
  else
    warn "5. GEMINI_API_KEY missing from .env. Add it (from https://aistudio.google.com/apikey)."
  fi
else
  warn "5. .env not found yet. Copy: cp .env.example .env"
fi

# 6. Telegram bot token
if [ -f .env ]; then
  if grep -q '^TELEGRAM_BOT_TOKEN=' .env; then
    TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
    if [ -z "$TOKEN" ] || is_placeholder "$TOKEN"; then
      warn "6. TELEGRAM_BOT_TOKEN in .env is the placeholder. Get one from @BotFather."
    elif [ ${#TOKEN} -lt 20 ]; then
      fail "6. TELEGRAM_BOT_TOKEN in .env looks too short (${#TOKEN} chars)."
    else
      pass "6. TELEGRAM_BOT_TOKEN in .env (${#TOKEN} chars)"
    fi
  else
    warn "6. TELEGRAM_BOT_TOKEN missing from .env. Get one from @BotFather on Telegram."
  fi
fi

# 7. Vertex AI API enabled (only if gcloud is set)
if command -v gcloud >/dev/null 2>&1 && [ -n "$(gcloud config get-value project 2>/dev/null)" ]; then
  if gcloud services list --enabled --filter='aiplatform.googleapis.com' --format='value(name)' 2>/dev/null | grep -q aiplatform; then
    pass "7. Vertex AI API enabled"
  else
    warn "7. Vertex AI API not enabled. Run: gcloud services enable aiplatform.googleapis.com"
  fi
else
  warn "7. Skipping Vertex AI API check (gcloud + project required)"
fi

# Allowed senders sanity (advisory)
if [ -f .env ]; then
  ALLOW=$(grep '^ALLOWED_SENDERS=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
  if [ -z "$ALLOW" ]; then
    warn "   ALLOWED_SENDERS is empty — your bot will reject every Telegram message until you set it to your numeric ID. Get it from @userinfobot."
  fi
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ All required checks passed.${NC} You are ready for Day 1."
  exit 0
else
  echo -e "${RED}❌ $FAILED required check(s) failed.${NC} Fix the lines marked ✗ above and re-run."
  exit 1
fi
