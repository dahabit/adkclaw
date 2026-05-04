#!/usr/bin/env bash
# AdkClaw — deploy both Cloud Run services + map domains.
#
# Idempotent: re-runnable. Skips already-completed steps.
# Run from repo root: ./platform/deploy/deploy-all.sh

set -euo pipefail

PROJECT="adkclaw-prod"
REGION="us-central1"
DOMAIN_APEX="adkclaw.dev"
DOMAIN_API="api.adkclaw.dev"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

# ─── Pre-flight ───────────────────────────────────────────────────────────────
step "Pre-flight"
gcloud config set project "$PROJECT" >/dev/null
gcloud config set run/region "$REGION" >/dev/null
ok "Project: $(gcloud config get-value project 2>&1)"
ok "Region:  $(gcloud config get-value run/region 2>&1)"

# ─── Step 1: INSTRUCTOR_TOKEN secret ─────────────────────────────────────────
step "Step 1 — INSTRUCTOR_TOKEN secret"
if gcloud secrets describe instructor-token --project="$PROJECT" >/dev/null 2>&1; then
  ok "instructor-token secret already exists"
else
  openssl rand -hex 32 | gcloud secrets create instructor-token \
    --replication-policy="automatic" \
    --data-file=- \
    --project="$PROJECT" >/dev/null
  ok "instructor-token secret created"
fi

# ─── Step 2: IAM for Cloud Run runtime service account ───────────────────────
step "Step 2 — IAM for Cloud Run runtime SA"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for ROLE in roles/datastore.user roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null 2>&1 || true
  ok "$ROLE → $RUNTIME_SA"
done

# ─── Step 3: Deploy API ──────────────────────────────────────────────────────
step "Step 3 — Deploy adkclaw-api (Express + Firestore)"
gcloud run deploy adkclaw-api \
  --source=./platform/api \
  --project="$PROJECT" \
  --region="$REGION" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=80 \
  --timeout=60 \
  --port=8080 \
  --service-account="$RUNTIME_SA" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT,NODE_ENV=production,CORS_ORIGIN=https://${DOMAIN_APEX},LOG_LEVEL=info,RATE_LIMIT_PER_MINUTE=60" \
  --set-secrets="INSTRUCTOR_TOKEN=instructor-token:latest" \
  --quiet

API_URL=$(gcloud run services describe adkclaw-api --region="$REGION" --format='value(status.url)')
ok "adkclaw-api → $API_URL"

# ─── Step 4: Deploy Frontend ─────────────────────────────────────────────────
step "Step 4 — Deploy adkclaw-frontend (Next.js)"
gcloud run deploy adkclaw-frontend \
  --source=./platform/frontend \
  --project="$PROJECT" \
  --region="$REGION" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=80 \
  --timeout=60 \
  --port=3000 \
  --service-account="$RUNTIME_SA" \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://${DOMAIN_API},NODE_ENV=production" \
  --quiet

FRONTEND_URL=$(gcloud run services describe adkclaw-frontend --region="$REGION" --format='value(status.url)')
ok "adkclaw-frontend → $FRONTEND_URL"

# ─── Step 5: Map domains ─────────────────────────────────────────────────────
step "Step 5 — Map domains"

map_domain() {
  local SERVICE="$1"; local DOMAIN="$2"
  if gcloud beta run domain-mappings describe \
      --domain="$DOMAIN" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    ok "$DOMAIN already mapped"
  else
    gcloud beta run domain-mappings create \
      --service="$SERVICE" \
      --domain="$DOMAIN" \
      --region="$REGION" \
      --project="$PROJECT" \
      --quiet 2>&1 | tail -3 || warn "domain mapping create returned non-zero (often OK; SSL provisioning kicks off async)"
    ok "$DOMAIN mapping initiated"
  fi
}

map_domain adkclaw-frontend "$DOMAIN_APEX"
map_domain adkclaw-api "$DOMAIN_API"

# ─── Step 6: Verify ──────────────────────────────────────────────────────────
step "Step 6 — Verify"

echo ""
echo "Cloud Run services:"
gcloud run services list --region="$REGION" --format='table(metadata.name,status.url,status.conditions[0].status)'

echo ""
echo "Domain mappings (SSL may take 5-15 min to provision):"
gcloud beta run domain-mappings list --region="$REGION" --format='table(metadata.name,spec.routeName,status.conditions[0].type,status.conditions[0].status)' 2>&1 | head -20

echo ""
echo "Quick reachability check:"
echo "  Cloud Run API URL: $API_URL"
echo "    $(curl -sI -m 5 "$API_URL/api/health" 2>&1 | head -1 || echo 'not reachable yet')"
echo "  Cloud Run Frontend URL: $FRONTEND_URL"
echo "    $(curl -sI -m 5 "$FRONTEND_URL/" 2>&1 | head -1 || echo 'not reachable yet')"

echo ""
echo -e "${GREEN}━━━ Deploy complete ━━━${NC}"
echo "  Apex (SSL provisioning):  https://${DOMAIN_APEX}"
echo "  API  (SSL provisioning):  https://${DOMAIN_API}"
echo ""
echo "SSL certificates take 5-15 min to provision after first domain mapping."
echo "Re-check with:  curl -I https://${DOMAIN_APEX}"
