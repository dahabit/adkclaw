#!/usr/bin/env node
/**
 * Generates the 12 painterly avatars via Vertex AI Imagen 3.
 *
 * Output: platform/frontend/public/avatars/<id>.png
 * Cost:   ~$0.04 × 12 = ~$0.48 against the active GCP project.
 *
 * Run:
 *   gcloud config set project adkclaw-prod
 *   node scripts/generate-avatars.mjs        [--id chrome,bronze,...]
 *                                            [--seed N]   # vary look
 *                                            [--skip-existing]
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'avatars');

const SPECS = [
  // Boys
  {
    id: 'chrome',
    category: 'boy',
    personality: 'studious',
    look: 'short dark hair, round glasses, light beard, focused expression',
  },
  {
    id: 'bronze',
    category: 'boy',
    personality: 'cool',
    look: 'curly black hair, mirror sunglasses, slight smirk, leather jacket',
  },
  {
    id: 'slate',
    category: 'boy',
    personality: 'friendly',
    look: 'wavy brown hair, big warm smile, freckles, hoodie',
  },
  {
    id: 'cosmic',
    category: 'boy',
    personality: 'creative',
    look: 'long wavy hair tied back, paint splatter on jacket, thoughtful look, gentle smile',
  },

  // Girls with hijab
  {
    id: 'forest',
    category: 'hijab-girl',
    personality: 'studious',
    look: 'emerald green hijab, oval glasses, holding a book, calm focused expression',
  },
  {
    id: 'arctic',
    category: 'hijab-girl',
    personality: 'cool',
    look: 'sky blue silk hijab, confident smile, fashionable cape collar',
  },
  {
    id: 'mint',
    category: 'hijab-girl',
    personality: 'friendly',
    look: 'rose pink hijab, beaming smile, warm cheeks, cozy sweater',
  },
  {
    id: 'lavender',
    category: 'hijab-girl',
    personality: 'creative',
    look: 'violet patterned hijab, small earrings, playful curious expression',
  },

  // Girls without hijab
  {
    id: 'sky',
    category: 'girl',
    personality: 'studious',
    look: 'short bob hair with cyan streak, square glasses, intense focus',
  },
  {
    id: 'coral',
    category: 'girl',
    personality: 'cool',
    look: 'long straight black hair, smokey eye makeup, leather jacket, slight smile',
  },
  {
    id: 'gold',
    category: 'girl',
    personality: 'friendly',
    look: 'curly golden blonde hair, freckles, huge smile, denim jacket',
  },
  {
    id: 'sunset',
    category: 'girl',
    personality: 'creative',
    look: 'shoulder length wavy auburn hair with copper highlights, paint on hands, sparkling eyes',
  },
];

const STYLE = [
  'a painterly digital portrait',
  'sci-fi fantasy character art style',
  'rich watercolor and digital paint texture',
  'soft warm cinematic lighting',
  'head and shoulders only',
  'looking towards the camera',
  'subtle smile, kind eyes',
  'highly detailed face',
  'concept art quality',
  'neutral dark slate-blue background with very soft glow',
];

function buildPrompt(spec) {
  const subject =
    spec.category === 'boy'
      ? 'a young man'
      : spec.category === 'hijab-girl'
        ? 'a young woman wearing a hijab'
        : 'a young woman';

  return [
    `${STYLE[0]} of ${subject}, ${spec.look}.`,
    `${STYLE.slice(1).join(', ')}.`,
    'No text, no watermark, no logos.',
  ].join(' ');
}

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}
const onlyIds = (flag('--id') || '').split(',').filter(Boolean);
const skipExisting = args.includes('--skip-existing');
const baseSeed = parseInt(flag('--seed') || '1', 10);

function gcloudArg(args) {
  return execFileSync('gcloud', args, { encoding: 'utf8' }).trim();
}

const project = gcloudArg(['config', 'get-value', 'project']);
const token = gcloudArg(['auth', 'print-access-token']);
if (!project || project === '(unset)') {
  console.error('No active gcloud project. Run: gcloud config set project <id>');
  process.exit(1);
}

const ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`;

mkdirSync(OUT_DIR, { recursive: true });

const targets = onlyIds.length ? SPECS.filter((s) => onlyIds.includes(s.id)) : SPECS;
console.log(`Generating ${targets.length} portrait(s) → ${OUT_DIR}`);
console.log(`Project: ${project}`);
console.log('');

let total = 0;
let skipped = 0;
let failed = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 35_000; // ~1 req per 35 s — safely under the per-minute quota
const MAX_RETRIES = 4;

async function callImagen(body) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) return { ok: true, json: await res.json() };

    const text = await res.text();
    const isQuota = res.status === 429;
    if (isQuota && attempt < MAX_RETRIES) {
      const backoff = THROTTLE_MS * attempt;
      process.stdout.write(`429 (retry in ${Math.round(backoff / 1000)}s) … `);
      await sleep(backoff);
      continue;
    }
    return { ok: false, status: res.status, text };
  }
  return { ok: false, status: 0, text: 'exhausted retries' };
}

let firstCall = true;
for (const spec of targets) {
  const outPath = join(OUT_DIR, `${spec.id}.png`);

  if (skipExisting && existsSync(outPath)) {
    console.log(`  ↷ skip ${spec.id} (exists)`);
    skipped++;
    continue;
  }

  if (!firstCall) await sleep(THROTTLE_MS);
  firstCall = false;

  const prompt = buildPrompt(spec);
  process.stdout.write(
    `  ▸ ${spec.id.padEnd(10)} ${spec.category.padEnd(11)} ${spec.personality.padEnd(9)} … `,
  );

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_adult',
      addWatermark: false,
      seed: baseSeed + total,
    },
  };

  try {
    const result = await callImagen(body);
    if (!result.ok) {
      console.log(`FAILED (${result.status})`);
      console.error(`    ${(result.text || '').slice(0, 240)}`);
      failed++;
      continue;
    }
    const pred = result.json.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      console.log('FAILED (no image returned)');
      console.error(`    ${JSON.stringify(result.json).slice(0, 200)}`);
      failed++;
      continue;
    }

    const png = Buffer.from(pred.bytesBase64Encoded, 'base64');
    writeFileSync(outPath, png);
    console.log(`OK (${(png.length / 1024).toFixed(0)} KB)`);
    total++;
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    failed++;
  }
}

console.log('');
console.log(`Generated: ${total}  Skipped: ${skipped}  Failed: ${failed}`);
console.log(`Cost estimate: ~$${(total * 0.04).toFixed(2)}`);
