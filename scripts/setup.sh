#!/bin/bash
#
# AdkClaw — Setup Script
#
# This script bootstraps your AdkClaw workshop environment in Cloud Shell:
#   1. Verifies gcloud authentication
#   2. Detects your Google Cloud project
#   3. Enables required APIs (Vertex AI, Cloud Run, Cloud Build, Secret Manager)
#   4. Optionally connects you to a workshop event for the live dashboard
#   5. Writes ~/adkclaw/set_env.sh for the rest of the workshop to source
#
# Run from the project root: ./scripts/setup.sh
#

set -e

# Resolve project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load workshop config
WORKSHOP_CONFIG="${PROJECT_ROOT}/workshop.config.json"

if [ ! -f "$WORKSHOP_CONFIG" ]; then
    echo -e "${RED}Error: workshop.config.json not found at ${WORKSHOP_CONFIG}${NC}"
    exit 1
fi

API_BASE=$(python3 -c "import json; print(json.load(open('${WORKSHOP_CONFIG}'))['api_base_url'])" 2>/dev/null || echo "")
DEFAULT_REGION=$(python3 -c "import json; print(json.load(open('${WORKSHOP_CONFIG}'))['default_region'])" 2>/dev/null || echo "us-central1")

CONFIG_FILE="${PROJECT_ROOT}/config.json"
ENV_FILE="${PROJECT_ROOT}/set_env.sh"

# Banner
echo ""
echo -e "${CYAN}🤖 Welcome to AdkClaw!${NC}"
echo -e "${CYAN}   Building autonomous AI agents on Google ADK${NC}"
echo ""

# =============================================================================
# Step 1: Verify Cloud Shell or local environment
# =============================================================================
echo "Checking environment..."
if [ -n "$CLOUD_SHELL" ]; then
    echo -e "${GREEN}✓ Running in Google Cloud Shell${NC}"
else
    echo -e "${YELLOW}⚠️  Not in Cloud Shell — that's fine, just make sure gcloud is installed${NC}"
fi

# =============================================================================
# Step 2: Verify gcloud authentication
# =============================================================================
echo "Checking Google Cloud authentication..."
if ! gcloud auth print-access-token > /dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated with Google Cloud.${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"

# =============================================================================
# Step 3: Detect / select Google Cloud project
# =============================================================================
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "(unset)" ]; then
    echo -e "${YELLOW}No active project. Listing your projects:${NC}"
    gcloud projects list --format="table(projectId,name,projectNumber)"
    echo ""
    read -p "Enter project ID to use: " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${RED}Error: No project selected${NC}"
        exit 1
    fi
    gcloud config set project "$PROJECT_ID" --quiet
fi
echo -e "Using project: ${CYAN}${PROJECT_ID}${NC}"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)

# =============================================================================
# Step 4: Enable required APIs
# =============================================================================
echo ""
echo -e "${YELLOW}Enabling required APIs (this may take 1-2 minutes)…${NC}"

APIS=(
    "aiplatform.googleapis.com"        # Vertex AI (Gemini, embeddings, vector search)
    "run.googleapis.com"               # Cloud Run (Level 4)
    "cloudbuild.googleapis.com"        # Cloud Build
    "secretmanager.googleapis.com"     # Secret Manager (Level 4)
    "firestore.googleapis.com"         # Firestore (Level 4)
    "storage.googleapis.com"           # Cloud Storage (Level 4)
    "cloudscheduler.googleapis.com"    # Cloud Scheduler (Level 4)
    "logging.googleapis.com"           # Cloud Logging
)

for api in "${APIS[@]}"; do
    if gcloud services list --enabled --filter="name:${api}" --format="value(name)" 2>/dev/null | grep -q "${api}"; then
        echo -e "${GREEN}  ✓ ${api}${NC}"
    else
        gcloud services enable "${api}" --quiet 2>/dev/null && \
            echo -e "${GREEN}  ✓ enabled ${api}${NC}" || \
            echo -e "${RED}  ✗ failed to enable ${api}${NC}"
    fi
done

# =============================================================================
# Step 5: Get event code (optional — for live dashboard)
# =============================================================================
echo ""
echo -e "Enter your event code (from your instructor or QR code)."
echo -e "If you're learning on your own, press Enter for ${YELLOW}sandbox${NC}."
read -p "Event code [sandbox]: " EVENT_CODE
EVENT_CODE=${EVENT_CODE:-sandbox}
EVENT_CODE=$(echo "$EVENT_CODE" | xargs)

# =============================================================================
# Step 6: Get explorer/username (optional — for live dashboard)
# =============================================================================
echo ""
read -p "Choose your workshop username (2-20 chars, letters/numbers/-/_): " USERNAME
if [ -z "$USERNAME" ]; then
    USERNAME="anonymous-$(date +%s)"
fi
USERNAME=$(echo "$USERNAME" | xargs)
if ! [[ "$USERNAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo -e "${YELLOW}Username has invalid characters. Using 'anonymous-$(date +%s)'.${NC}"
    USERNAME="anonymous-$(date +%s)"
fi

# =============================================================================
# Step 7: Get Gemini API key (Levels 1-3 use Gemini API; Level 4 swaps to Vertex)
# =============================================================================
echo ""
echo -e "${CYAN}Get a free Gemini API key at: https://aistudio.google.com/apikey${NC}"
read -p "Paste your GEMINI_API_KEY (or press Enter to skip — Level 4 uses Vertex AI directly): " GEMINI_API_KEY

# =============================================================================
# Step 8: Get Telegram bot token (Levels 1-4)
# =============================================================================
echo ""
echo -e "${CYAN}Create a Telegram bot via https://t.me/BotFather (send /newbot)${NC}"
read -p "Paste your TELEGRAM_BOT_TOKEN (or press Enter to skip — you can do this in Level 1): " TELEGRAM_BOT_TOKEN

# =============================================================================
# Step 9: Write config.json (workshop dashboard binding)
# =============================================================================
cat > "$CONFIG_FILE" << EOF
{
    "event_code": "${EVENT_CODE}",
    "username": "${USERNAME}",
    "project_id": "${PROJECT_ID}",
    "project_number": "${PROJECT_NUMBER}",
    "region": "${DEFAULT_REGION}",
    "api_base": "${API_BASE}"
}
EOF

# =============================================================================
# Step 10: Write set_env.sh (sourced by all levels)
# =============================================================================
cat > "$ENV_FILE" << EOF
#!/bin/bash
# AdkClaw — generated by ./scripts/setup.sh — source this before each level
export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"
export PROJECT_ID="${PROJECT_ID}"
export PROJECT_NUMBER="${PROJECT_NUMBER}"
export REGION="${DEFAULT_REGION}"
export GOOGLE_CLOUD_LOCATION="${DEFAULT_REGION}"
export GOOGLE_GENAI_USE_VERTEXAI="True"
export ADKCLAW_EVENT_CODE="${EVENT_CODE}"
export ADKCLAW_USERNAME="${USERNAME}"
export GEMINI_API_KEY="${GEMINI_API_KEY}"
export TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
EOF
chmod +x "$ENV_FILE"

# =============================================================================
# Step 11: Verify Node.js
# =============================================================================
echo ""
echo "Verifying Node.js…"
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION} detected${NC}"
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo -e "${YELLOW}⚠️  Node 22+ recommended. In Cloud Shell: nvm install 22 && nvm use 22${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Node.js not found. In Cloud Shell: nvm install 22${NC}"
fi

# =============================================================================
# Done
# =============================================================================
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "Project:       ${CYAN}${PROJECT_ID}${NC}"
echo -e "Region:        ${CYAN}${DEFAULT_REGION}${NC}"
echo -e "Event:         ${CYAN}${EVENT_CODE}${NC}"
echo -e "Username:      ${CYAN}${USERNAME}${NC}"
echo -e "Config file:   ${CYAN}${CONFIG_FILE}${NC}"
echo -e "Env file:      ${CYAN}${ENV_FILE}${NC}"
echo ""
echo -e "${YELLOW}Next:${NC}"
echo -e "  1. ${CYAN}source ${ENV_FILE}${NC}"
echo -e "  2. ${CYAN}cd level_0 && cat README.md${NC}"
echo -e "  3. Or jump straight to: https://codelabs.developers.google.com/adkclaw-level-0/instructions"
echo ""
