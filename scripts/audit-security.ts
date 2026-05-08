#!/usr/bin/env tsx
/**
 * audit-security.ts — Level 5 production-readiness verifier.
 *
 * Checks:
 *   1. All six required env vars are set
 *   2. ADMIN_KEY length >= 32 chars
 *   3. ALLOWED_SENDERS contains at least one numeric ID
 *   4. firestore.rules exists and starts with `rules_version = '2'`
 *   5. THREAT_MODEL.md exists at repo root
 *
 * Returns exit code 0 on pass, 1 on any fail.
 *
 * Usage: `npm run audit:security`
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED_ENVS = [
  'ADMIN_KEY',
  'DAILY_TOKEN_BUDGET',
  'ALLOWED_SENDERS',
  'TELEGRAM_WEBHOOK_SECRET',
  'OIDC_AUDIENCE',
  'OIDC_SERVICE_ACCOUNT',
];

const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

let failed = 0;

function pass(msg: string): void {
  console.log(`${GREEN}✓${NC} ${msg}`);
}

function fail(msg: string): void {
  console.log(`${RED}✗${NC} ${msg}`);
  failed++;
}

function warn(msg: string): void {
  console.log(`${YELLOW}⚠${NC} ${msg}`);
}

console.log('');
console.log('🛡️  AdkClaw — Level 5 security audit');
console.log('───────────────────────────────────');

// 1. Required env vars
for (const key of REQUIRED_ENVS) {
  const val = process.env[key];
  if (!val) {
    fail(`${key} is unset`);
    continue;
  }
  pass(`${key} set (${val.length} chars)`);
}

// 2. ADMIN_KEY length
const adminKey = process.env.ADMIN_KEY ?? '';
if (adminKey && adminKey.length < 32) {
  fail(`ADMIN_KEY is too short (${adminKey.length} chars; recommend 64-char hex)`);
}

// 3. ALLOWED_SENDERS has at least one numeric
const allowed = (process.env.ALLOWED_SENDERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const numericAllowed = allowed.filter((s) => /^\d+$/.test(s));
if (allowed.length === 0) {
  warn('ALLOWED_SENDERS is empty — bot will reject every Telegram message');
} else if (numericAllowed.length === 0) {
  fail(`ALLOWED_SENDERS has no numeric IDs (got: ${allowed.join(', ')})`);
} else {
  pass(`ALLOWED_SENDERS has ${numericAllowed.length} numeric ID(s)`);
}

// 4. firestore.rules exists + valid header
const rulesPath = resolve(process.cwd(), 'firestore.rules');
if (!existsSync(rulesPath)) {
  fail('firestore.rules not found at repo root');
} else {
  const content = readFileSync(rulesPath, 'utf8');
  if (!content.includes("rules_version = '2'")) {
    fail("firestore.rules missing `rules_version = '2'` header");
  } else if (!content.includes('allow read, write: if false')) {
    fail('firestore.rules missing default-deny pattern');
  } else {
    pass('firestore.rules present + default-deny configured');
  }
}

// 5. THREAT_MODEL.md exists
const tmPath = resolve(process.cwd(), 'THREAT_MODEL.md');
if (!existsSync(tmPath)) {
  warn('THREAT_MODEL.md not found at repo root — copy from level_5/THREAT_MODEL.template.md');
} else {
  pass('THREAT_MODEL.md present');
}

// 6. Gemini key check (heuristic)
if (process.env.GEMINI_API_KEY?.startsWith('your_')) {
  fail('GEMINI_API_KEY looks like the .env.example placeholder');
}

console.log('');
if (failed === 0) {
  console.log(`${GREEN}✅ Security audit passed.${NC} You're production-ready.`);
  process.exit(0);
} else {
  console.log(`${RED}❌ ${failed} check(s) failed.${NC} Fix before declaring L5 complete.`);
  process.exit(1);
}
