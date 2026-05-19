// src/index.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { loadConfig, validateConfig } from './config/index.js';
import { ContextEngine } from './context/manager.js';
import { ToolRegistry } from './tools/registry.js';
import { registerCoreTools } from './tools/index.js';
import { AgentRunner } from './agent/runner.js';
import { SessionStore } from './sessions/store.js';
import { TelegramAdapter } from './channels/telegram.js';
import { createHttpServer } from './server/http.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { errors, warnings } = validateConfig(config);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[config] ${e}`);
    throw new Error('Invalid configuration — see errors above.');
  }

  const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const registry = new ToolRegistry();
  registerCoreTools(registry);

  const sessions = new SessionStore(config.paths.database);
  const contextEngine = new ContextEngine(config.paths.workspace);
  const runner = new AgentRunner(client, registry, config);

  const app = createHttpServer(config, runner, contextEngine, sessions);
  app.listen(config.server.port, () => {
    console.log(`[http] listening on http://${config.server.host}:${config.server.port}`);
  });

  if (config.telegram.botToken) {
    const tg = new TelegramAdapter(config, runner, contextEngine, sessions);
    await tg.launch();
  }

  console.log(`🤖 ${config.agent.name} is online.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
