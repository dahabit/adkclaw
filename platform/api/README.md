# AdkClaw API

The workshop platform's backend. Express + Firestore. Deploys to Cloud Run as `adkclaw-api`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness check |
| POST | `/api/events` | Instructor creates an event |
| GET | `/api/events/:code` | Public event metadata |
| GET | `/api/events/:code/builders` | Fleet snapshot for the 3D globe / grid view |
| POST | `/api/builders` | Register a new builder (returns one-time HMAC secret) |
| GET | `/api/builders/:username` | Public profile + level completions |
| POST | `/api/builders/:username/badge` | Agent self-reports completion (HMAC-signed) |
| GET | `/api/regions` | List Cloud Run regions for the globe |

## Auth model

- Event creation: pre-shared `INSTRUCTOR_TOKEN` env var
- Badge POST: HMAC-SHA256 signed by per-builder secret (issued at registration, never retrievable again)
- All other reads: public

## Local dev

```bash
# 1. Start Firestore emulator (separate terminal)
npx firebase emulators:start --only firestore

# 2. Start API
cp .env.example .env
# Edit .env: set FIRESTORE_EMULATOR_HOST=localhost:8085
npm install
npm run dev
```

API at http://localhost:8080

## Deploy

```bash
gcloud run deploy adkclaw-api \
  --source=. \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-secrets=INSTRUCTOR_TOKEN=instructor-token:latest \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=adkclaw-prod,CORS_ORIGIN=https://adkclaw.dev
```

## Tests

```bash
npm test
```

## License

Apache 2.0 (inherits from repo root).
