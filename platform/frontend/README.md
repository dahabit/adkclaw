# AdkClaw Frontend

Next.js 15 app for `adkclaw.dev`. Style A — Cosmic Workshop.

## Pages

| Path | Purpose | Status |
|------|---------|--------|
| `/` | Landing page | ✅ Phase 1 |
| `/join/[event]` | Builder registration | ⏳ Phase 1 |
| `/profile` | Logged-in builder dashboard | ⏳ Phase 1 |
| `/u/[username]` | Public builder profile | ⏳ Phase 1 |
| `/e/[event]` | Cohort overview | ⏳ Phase 1 |
| `/e/[event]/fleet` | Fleet view (grid v1, 3D globe Phase 3) | ⏳ Phase 1/3 |
| `/quickstart` | 5-min Cloud Shell taste | ⏳ Phase 1 |

## Local dev

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend at http://localhost:3000

## Stack

- Next.js 15 (App Router)
- React 18
- Tailwind CSS 3.4
- Zustand 5
- TypeScript 5.6
- Inline SVG robot avatars (12 presets)

## Deploy

```bash
gcloud run deploy adkclaw-frontend \
  --source=. \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars=NEXT_PUBLIC_API_URL=https://api.adkclaw.dev
```

## Design tokens

See `tailwind.config.ts` and `styles/globals.css`. Style A locked:
- Slate-blue tinted neutrals (no pure black/gray)
- Cloud-blue accent (`#3B82F6`)
- Gold for deployed beacons (`#facc15` with glow)
- Space Grotesk (display) + Plus Jakarta Sans (body) + JetBrains Mono (code)
- Fluid type via `clamp()`
- Ease-out / in-out / mild-spring easing only — no bounce
- No purple gradients
