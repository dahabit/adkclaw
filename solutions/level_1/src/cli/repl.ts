import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadConfig } from '../config/index.js';

interface ChatResult {
  text?: string;
  error?: string;
  toolCallCount?: number;
  tokensUsed?: number;
  durationMs?: number;
  finishReason?: string;
}

export async function runRepl(): Promise<void> {
  const config = loadConfig();
  const url = `http://${config.server.host}:${config.server.port}/api/chat`;

  console.log(`🤖 AdkClaw CLI — chatting with ${config.agent.name}`);
  console.log(`   Endpoint: ${url}`);
  console.log(`   Commands: /clear (reset session), /quit\n`);

  const rl = readline.createInterface({ input, output });
  let sessionKey = `cli:local:${Date.now()}`;

  while (true) {
    let message: string;
    try {
      message = await rl.question('you ▸ ');
    } catch {
      break;
    }
    const trimmed = message.trim();
    if (!trimmed) continue;
    if (trimmed === '/quit' || trimmed === '/exit' || trimmed === ':q') break;
    if (trimmed === '/clear') {
      sessionKey = `cli:local:${Date.now()}`;
      console.log('(session reset)\n');
      continue;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionKey,
          message: trimmed,
          channel: 'cli',
          senderId: 'cli',
        }),
      });
      if (!response.ok) {
        console.log(`agent ▸ ⚠️  HTTP ${response.status}\n`);
        continue;
      }
      const result = (await response.json()) as ChatResult;
      if (result.error) {
        console.log(`agent ▸ ⚠️  ${result.error}\n`);
      } else {
        console.log(`agent ▸ ${result.text ?? ''}\n`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`agent ▸ ⚠️  ${msg}\n`);
      console.log('   (is the daemon running? `npm run dev`)\n');
    }
  }
  rl.close();
}

const isDirectExecution = (() => {
  const url = process.argv[1];
  return Boolean(url && import.meta.url.endsWith(url.replace(/^file:\/\//, '')));
})();

if (isDirectExecution) {
  runRepl().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
