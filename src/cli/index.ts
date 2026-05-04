#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const HELP = `
🤖 adkclaw — autonomous agent CLI

Usage:
  adkclaw setup    Interactive: name your agent, configure keys
  adkclaw start    Start the gateway daemon (Telegram + HTTP)
  adkclaw chat     Open a terminal REPL connected to the gateway
  adkclaw check    Pre-flight diagnostics — validate config + ping daemon
  adkclaw help     Show this message

For development:
  npm run setup    Configure agent (writes .env + workspace/)
  npm run dev      Start daemon with hot reload
  npm run chat     Open REPL in second terminal

To install adkclaw globally:
  npm run build && npm link
`;

const cmd = process.argv[2] ?? 'help';

async function runCheck(): Promise<void> {
  console.log('\n🤖 AdkClaw — pre-flight check\n');
  let allOk = true;

  const envPath = resolve(process.cwd(), '.env');
  const yamlPath = resolve(process.cwd(), 'agent.yaml');
  const wsPath = resolve(process.cwd(), 'workspace');

  for (const [label, path] of [
    ['.env', envPath],
    ['agent.yaml', yamlPath],
    ['workspace/', wsPath],
  ] as [string, string][]) {
    if (existsSync(path)) {
      console.log(`  ✓ ${label} found`);
    } else {
      console.error(`  ✗ ${label} not found — run: npm run setup`);
      allOk = false;
    }
  }

  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8');
    const env: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m?.[1] && m[2] !== undefined) env[m[1]] = m[2].trim();
    }

    const geminiKey = env['GEMINI_API_KEY'] ?? '';
    if (geminiKey && !geminiKey.startsWith('your_')) {
      console.log(`  ✓ GEMINI_API_KEY set (${geminiKey.slice(0, 6)}…)`);
    } else {
      console.error('  ✗ GEMINI_API_KEY missing — get one at https://aistudio.google.com/apikey');
      allOk = false;
    }

    const tgToken = env['TELEGRAM_BOT_TOKEN'] ?? '';
    if (tgToken && !tgToken.startsWith('your_')) {
      console.log(`  ✓ TELEGRAM_BOT_TOKEN set (${tgToken.slice(0, 8)}…)`);
    } else {
      console.error('  ✗ TELEGRAM_BOT_TOKEN missing — create a bot via @BotFather');
      allOk = false;
    }

    const allowedSenders = env['ALLOWED_SENDERS'] ?? '';
    if (!allowedSenders) {
      console.error('  ✗ ALLOWED_SENDERS empty — Telegram will reject all messages');
      console.error(
        '    Fix: send /start to your bot → copy the numeric ID → ALLOWED_SENDERS=<number>',
      );
      allOk = false;
    } else {
      const ids = allowedSenders
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const bad = ids.filter((id) => !/^\d+$/.test(id));
      if (bad.length > 0) {
        console.error(`  ✗ ALLOWED_SENDERS has usernames, not numeric IDs: ${bad.join(', ')}`);
        console.error('    Fix: send /start to your bot → it will reply with your numeric ID');
        allOk = false;
      } else {
        console.log(`  ✓ ALLOWED_SENDERS: ${ids.length} sender(s) configured`);
      }
    }

    const model = env['DEFAULT_MODEL'] || 'gemini-2.5-pro';
    console.log(`  ✓ DEFAULT_MODEL: ${model}`);

    const budget = Number(env['DAILY_TOKEN_BUDGET'] ?? 500000);
    if (budget < 1000) {
      console.error(`  ✗ DAILY_TOKEN_BUDGET=${budget} is too low (min 1000)`);
      allOk = false;
    } else {
      console.log(`  ✓ DAILY_TOKEN_BUDGET: ${budget.toLocaleString()}`);
    }
  }

  const port = (() => {
    if (!existsSync(envPath)) return '3000';
    const m = readFileSync(envPath, 'utf8').match(/^PORT=(\d+)/m);
    return m ? m[1] : '3000';
  })();

  process.stdout.write(`  … pinging daemon on :${port} → `);
  try {
    const resp = await fetch(`http://localhost:${port}/api/health`);
    const json = (await resp.json()) as { ok?: boolean };
    if (json.ok) {
      console.log('✓ daemon is running');
      const status = (await fetch(`http://localhost:${port}/api/status`).then((r) => r.json())) as {
        agentName?: string;
        defaultModel?: string;
        activeSessionCount?: number;
        uptimeSec?: number;
      };
      console.log(`    Agent: ${status.agentName ?? '?'}`);
      console.log(`    Model: ${status.defaultModel ?? '?'}`);
      console.log(`    Active sessions: ${status.activeSessionCount ?? 0}`);
      console.log(`    Uptime: ${status.uptimeSec ?? 0}s`);
      console.log(`    Dashboard: http://localhost:${port}/`);
    } else {
      console.log('daemon replied but not healthy');
    }
  } catch {
    console.log('not running');
    console.log('    Start it: npm run dev');
  }

  console.log('');
  if (allOk) {
    console.log('✅ All checks passed.\n');
  } else {
    console.log('⚠️  Fix the issues above, then re-run: adkclaw check\n');
  }
}

async function main(): Promise<void> {
  switch (cmd) {
    case 'setup': {
      const { runSetup } = await import('./setup.js');
      await runSetup();
      return;
    }
    case 'start': {
      await import('../index.js');
      return;
    }
    case 'chat': {
      const { runRepl } = await import('./repl.js');
      await runRepl();
      return;
    }
    case 'check':
    case 'doctor':
      await runCheck();
      return;
    case 'help':
    case '-h':
    case '--help':
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
