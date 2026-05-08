#!/usr/bin/env bash
# AdkClaw — graduate cleanup script.
# Tears down everything Level 4 created so a graduated student can stop
# paying for / worrying about a deployed agent. Idempotent + interactive.
# Run from repo root: ./scripts/graduate-cleanup.sh

set -u
cd "$(dirname "$0")/.." || exit 1

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

confirm() {
  local prompt="$1"
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

PROJECT="$(gcloud config get-value project 2>/dev/null)"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE_NAME:-adkclaw}"

if [ -z "$PROJECT" ]; then
  echo -e "${RED}No active GCP project.${NC} Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo ""
echo "🧹 AdkClaw graduate cleanup"
echo "──────────────────────────"
echo "Project:  $PROJECT"
echo "Region:   $REGION"
echo "Service:  $SERVICE"
echo ""
echo -e "${YELLOW}This will permanently delete the Cloud Run service, Firestore collections,${NC}"
echo -e "${YELLOW}Cloud Storage bucket, Cloud Scheduler jobs, and the Telegram webhook.${NC}"
echo -e "${YELLOW}Your local repo is not touched.${NC}"
echo ""

confirm "Proceed?" || { echo "Aborted."; exit 0; }

# 1. Cloud Run
if gcloud run services describe "$SERVICE" --region="$REGION" >/dev/null 2>&1; then
  if confirm "Delete Cloud Run service '$SERVICE'?"; then
    gcloud run services delete "$SERVICE" --region="$REGION" --quiet
    echo -e "${GREEN}✓${NC} Cloud Run service deleted."
  fi
else
  echo "  (Cloud Run service '$SERVICE' not found — skipping.)"
fi

# 2. Cloud Scheduler jobs
JOBS=$(gcloud scheduler jobs list --location="$REGION" --filter="name:adkclaw" --format='value(name)' 2>/dev/null || true)
if [ -n "$JOBS" ]; then
  if confirm "Delete Cloud Scheduler jobs ($(echo "$JOBS" | wc -l | xargs))?"; then
    while IFS= read -r job; do
      gcloud scheduler jobs delete "$job" --location="$REGION" --quiet
    done <<< "$JOBS"
    echo -e "${GREEN}✓${NC} Cloud Scheduler jobs deleted."
  fi
fi

# 3. Cloud Storage
BUCKET="gs://${PROJECT}-adkclaw"
if gcloud storage buckets describe "$BUCKET" >/dev/null 2>&1; then
  if confirm "Delete Cloud Storage bucket $BUCKET (and all contents)?"; then
    gcloud storage rm -r "$BUCKET"
    echo -e "${GREEN}✓${NC} Cloud Storage bucket deleted."
  fi
fi

# 4. Secret Manager (optional)
SECRETS=$(gcloud secrets list --filter='name:gemini-api-key OR name:telegram-bot-token OR name:telegram-webhook-secret OR name:adkclaw-allowlist' --format='value(name)' 2>/dev/null || true)
if [ -n "$SECRETS" ]; then
  echo "  Secrets that look like AdkClaw: $(echo "$SECRETS" | tr '\n' ' ')"
  if confirm "Delete these Secret Manager secrets?"; then
    while IFS= read -r s; do
      gcloud secrets delete "$s" --quiet
    done <<< "$SECRETS"
    echo -e "${GREEN}✓${NC} Secrets deleted."
  fi
fi

# 5. Telegram webhook (idempotent — fine to call even if no token)
if [ -f .env ] && grep -q '^TELEGRAM_BOT_TOKEN=' .env; then
  TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
  if [ -n "$TOKEN" ] && [[ ! "$TOKEN" == your_* ]]; then
    if confirm "Delete the Telegram webhook for your bot?"; then
      curl -s "https://api.telegram.org/bot${TOKEN}/deleteWebhook" >/dev/null
      echo -e "${GREEN}✓${NC} Telegram webhook removed."
    fi
  fi
fi

# 6. Firestore note
echo ""
echo -e "${YELLOW}Firestore note:${NC}"
echo "  Firestore databases cannot be deleted via the CLI. Either:"
echo "    a) leave it (free tier quota means no charge), or"
echo "    b) delete the collections individually:"
echo "       gcloud firestore documents delete <path> --recursive"
echo "    c) delete the whole project: gcloud projects delete $PROJECT"

echo ""
echo -e "${GREEN}✅ Cleanup complete.${NC}"
echo ""
echo "Next steps you may want to do manually:"
echo "  • Revoke your Gemini API key:    https://aistudio.google.com/apikey"
echo "  • Revoke your Telegram bot:      send /revoke to @BotFather"
echo "  • Delete the GCP project:        gcloud projects delete $PROJECT"
