// src/index.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { loadConfig, validateConfig } from './config/index.js';
import { ContextEngine } from './context/manager.js';
import { Compactor } from './context/compaction.js';
import { ToolRegistry } from './tools/registry.js';
import { registerCoreTools } from './tools/index.js';
import { makeMemorySaveTool, makeMemoryRecallTool, makeDailyAppendTool } from './tools/memory.js';
import { makeLoadSkillTool, makeListSkillsTool } from './tools/skills.js';
import { AgentRunner } from './agent/runner.js';
import { SessionStore } from './sessions/store.js';
import { TelegramAdapter } from './channels/telegram.js';
import { createHttpServer } from './server/http.js';

// Gemini's context window. Compaction triggers at 80% of it.
const MODEL_WINDOW = 1_000_000;

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
  // Level 2 tools — memory bank, daily notes, markdown skills.
  registry.register(makeMemorySaveTool());
  registry.register(makeMemoryRecallTool());
  registry.register(makeDailyAppendTool());
  registry.register(makeLoadSkillTool());
  registry.register(makeListSkillsTool());

  const sessions = new SessionStore(config.paths.database);
  const contextEngine = new ContextEngine(config.paths.workspace);
  const compactor = new Compactor({
    client,
    sessions,
    thresholdTokens: Math.floor(MODEL_WINDOW * 0.8),
    summarizerModel: config.gemini.fallbackModel,
  });
  const runner = new AgentRunner(client, registry, config);

  const app = createHttpServer(config, runner, contextEngine, sessions, compactor);
  app.listen(config.server.port, () => {
    console.log(`[http] listening on http://${config.server.host}:${config.server.port}`);
  });

  if (config.telegram.botToken) {
    const tg = new TelegramAdapter(config, runner, contextEngine, sessions, compactor);
    await tg.launch();
  }

  console.log(`🤖 ${config.agent.name} is online.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
