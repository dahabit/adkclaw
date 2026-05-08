#!/usr/bin/env bash
# AdkClaw — Gemini-assisted translation helper.
# Drafts an Arabic translation of a Markdown file. Human review required before merge.
#
# Usage: ./scripts/translate.sh <input.md> <output.ar.md>
#
# Requires: GEMINI_API_KEY in env (or .env), curl + jq.

set -u
cd "$(dirname "$0")/.." || exit 1

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <input.md> <output.ar.md>"
  echo "Example: $0 level_1/README.md level_1/README.ar.md"
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "input not found: $INPUT"
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  if [ -f .env ]; then
    GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2- | tr -d '"' | xargs)
  fi
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "GEMINI_API_KEY not set. Add it to .env or export it."
  exit 1
fi

MODEL="${TRANSLATE_MODEL:-gemini-3.1-pro-preview}"

SYSTEM_PROMPT='You are translating a technical Markdown document from English to Arabic for a workshop audience of MENA developers.

Rules:
1. Keep ALL code blocks (```...```) verbatim — never translate code.
2. Keep technical terms (function calling, event loop, OIDC, agent loop, middleware, async, await, etc.) in English; translate the surrounding prose only.
3. Use Modern Standard Arabic (MSA) with light dialect for warmth where appropriate.
4. Keep brand names verbatim (AdkClaw, Google, Gemini, Cloud Run, Telegram, Firestore, Vertex AI).
5. Preserve all Markdown structure: headings, tables, lists, links, image refs.
6. Keep all URLs and file paths verbatim.
7. For tables, translate header text but keep code-like cells (like `gemini-3.1-pro-preview`) verbatim.
8. Output ONLY the translated Markdown. No preamble, no explanation, no triple backticks around the output.'

# Read input
CONTENT=$(cat "$INPUT")

# Build JSON payload (use jq to escape safely)
PAYLOAD=$(jq -n \
  --arg sys "$SYSTEM_PROMPT" \
  --arg user "$CONTENT" \
  '{
    contents: [{ role: "user", parts: [{ text: $user }] }],
    systemInstruction: { parts: [{ text: $sys }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: 32768 }
  }')

echo "Translating $INPUT -> $OUTPUT (model: $MODEL)..."

RESPONSE=$(curl -sS -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Extract translated text
TRANSLATED=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty')

if [ -z "$TRANSLATED" ]; then
  echo "Translation failed. Response:"
  echo "$RESPONSE" | jq '.error // .' | head -20
  exit 1
fi

# Add language banner at top
{
  printf '> 🌐 **اللغة:** [English](%s) · **العربية**\n\n' "$(basename "$INPUT")"
  echo "$TRANSLATED"
} > "$OUTPUT"

echo ""
echo "Wrote $OUTPUT ($(wc -l < "$OUTPUT") lines)"
echo "Review the output before committing — automated translations need human eyes."
echo ""
echo "Next steps:"
echo "  1. Open $OUTPUT in your editor and verify code blocks are untouched"
echo "  2. Verify technical terms stayed in English"
echo "  3. Check tone: should match the AdkClaw direct-friendly voice in Arabic"
echo "  4. Add language banner to $INPUT pointing to $OUTPUT (only after review)"
