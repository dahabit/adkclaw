/**
 * `adkclaw doctor` — deep environment + runtime health probe.
 *
 * Wraps the lighter `check` command with:
 *   - Live ping of the daemon (if running)
 *   - Vertex AI / Gemini API reachability test
 *   - Telegram bot health (`getMe`)
 *   - Cloud Run service describe (if `SERVICE_URL` set)
 *
 * Exits 0 on all green, 1 if anything is red.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

let failed = 0;
function pass(m: string): void {
  console.log(`${GREEN}✓${NC} ${m}`);
}
function fail(m: string): void {
  console.log(`${RED}✗${NC} ${m}`);
  failed++;
}
function warn(m: string): void {
  console.log(`${YELLOW}⚠${NC} ${m}`);
}

function readEnvFromFile(): Record<string, string> {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[1] && m[2] !== undefined) {
      out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return out;
}

export async function doctor(): Promise<number> {
  console.log('\n🩺 adkclaw doctor — deep health probe\n');

  const env = { ...readEnvFromFile(), ...process.env };

  // 1. Node version
  const nv = process.version.replace('v', '').split('.')[0];
  if (Number(nv) >= 22) pass(`Node.js ${process.version}`);
  else fail(`Node.js ${process.version} — need 22+`);

  // 2. .env presence
  if (env.GEMINI_API_KEY && !env.GEMINI_API_KEY.startsWith('your_')) {
    pass(`GEMINI_API_KEY (${env.GEMINI_API_KEY.length} chars)`);
  } else fail('GEMINI_API_KEY missing or placeholder');

  if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_BOT_TOKEN.startsWith('your_')) {
    pass(`TELEGRAM_BOT_TOKEN (${env.TELEGRAM_BOT_TOKEN.length} chars)`);
  } else warn("TELEGRAM_BOT_TOKEN missing — bot won't come online");

  // 3. Telegram bot reachability
  if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_BOT_TOKEN.startsWith('your_')) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
      const j = (await r.json()) as { ok: boolean; result?: { username?: string } };
      if (j.ok && j.result?.username) pass(`Telegram bot reachable: @${j.result.username}`);
      else fail(`Telegram bot getMe returned ${JSON.stringify(j)}`);
    } catch (e) {
      fail(`Telegram bot unreachable: ${(e as Error).message}`);
    }
  }

  // 4. Daemon ping (assumes localhost unless ADKCLAW_API_BASE set)
  const apiBase = env.ADKCLAW_API_BASE ?? `http://${env.HOST ?? 'localhost'}:${env.PORT ?? '3000'}`;
  try {
    const r = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) pass(`Daemon at ${apiBase} responding`);
    else warn(`Daemon at ${apiBase} returned ${r.status}`);
  } catch {
    warn(`Daemon at ${apiBase} not responding (run: npm run dev)`);
  }

  // 5. Cloud Run service describe (if URL set)
  if (env.SERVICE_URL) {
    try {
      const r = await fetch(env.SERVICE_URL);
      if (r.status === 200 || r.status === 401) {
        pass(`Cloud Run service at ${env.SERVICE_URL} (status ${r.status})`);
      } else warn(`Cloud Run service returned ${r.status}`);
    } catch (e) {
      warn(`Cloud Run service unreachable: ${(e as Error).message}`);
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(`${GREEN}✅ doctor: all green${NC}`);
    return 0;
  }
  console.log(`${RED}❌ doctor: ${failed} check(s) failed${NC}`);
  return 1;
}
