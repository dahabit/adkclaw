// src/index.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { loadConfig, validateConfig } from './config/index.js';
import { ContextEngine } from './context/manager.js';
import { Compactor } from './context/compaction.js';
import { HealingEngine } from './healing/index.js';
import { MultiAgentOrchestrator } from './multi-agent/index.js';
import { CronEngine } from './cron/engine.js';
import { Heartbeat } from './cron/heartbeat.js';
import type { DeliveryFn } from './cron/types.js';
import { ToolRegistry } from './tools/registry.js';
import { registerCoreTools } from './tools/index.js';
import { makeMemorySaveTool, makeMemoryRecallTool, makeDailyAppendTool } from './tools/memory.js';
import { makeLoadSkillTool, makeListSkillsTool } from './tools/skills.js';
import {
  makeSpawnAgentTool,
  makeSpawnSearchTool,
  makeSpawnCommunicatorTool,
  makeSpawnResearcherTool,
  makeSpawnCoderTool,
} from './tools/spawn.js';
import {
  makeCronAddTool,
  makeCronRemoveTool,
  makeCronListTool,
  makeMessageUserTool,
} from './tools/cron.js';
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
  const healing = new HealingEngine();

  const sessions = new SessionStore(config.paths.database);
  const contextEngine = new ContextEngine(config.paths.workspace);
  const compactor = new Compactor({
    client,
    sessions,
    thresholdTokens: Math.floor(MODEL_WINDOW * 0.8),
    summarizerModel: config.gemini.fallbackModel,
  });

  const registry = new ToolRegistry();
  registerCoreTools(registry);
  // Level 2 tools — memory bank, daily notes, markdown skills.
  registry.register(makeMemorySaveTool());
  registry.register(makeMemoryRecallTool());
  registry.register(makeDailyAppendTool());
  registry.register(makeLoadSkillTool());
  registry.register(makeListSkillsTool());

  const runner = new AgentRunner(client, registry, config, healing);

  // Level 3 — sub-agent orchestration.
  const orchestrator = new MultiAgentOrchestrator({ runner, sessions, contextEngine, config });
  registry.register(makeSpawnAgentTool(orchestrator));
  registry.register(makeSpawnSearchTool(orchestrator));
  registry.register(makeSpawnCommunicatorTool(orchestrator));
  registry.register(makeSpawnResearcherTool(orchestrator));
  registry.register(makeSpawnCoderTool(orchestrator));

  // Delivery routes an unprompted message back to a channel. `telegram` is
  // assigned below — the closure reads it lazily.
  let telegram: TelegramAdapter | null = null;
  const delivery: DeliveryFn = async (channel, target, text) => {
    if (channel === 'telegram' && telegram) {
      await telegram.deliver(target, text);
      return;
    }
    console.log(`[delivery:${channel}:${target}] ${text}`);
  };

  // Level 3 — cron + heartbeat.
  const cronEngine = new CronEngine({
    runner,
    sessions,
    contextEngine,
    model: config.gemini.defaultModel,
    db: sessions.getDatabase(),
    delivery,
  });
  registry.register(makeCronAddTool(cronEngine));
  registry.register(makeCronRemoveTool(cronEngine));
  registry.register(makeCronListTool(cronEngine));
  registry.register(makeMessageUserTool(delivery));

  const heartbeat = new Heartbeat({
    runner,
    sessions,
    contextEngine,
    workspacePath: config.paths.workspace,
    intervalMs: config.agent.heartbeatIntervalMs,
    model: config.gemini.defaultModel,
    delivery,
    quietHours: { start: 22, end: 7 },
  });

  cronEngine.start();
  heartbeat.start();

  const app = createHttpServer(config, runner, contextEngine, sessions, compactor, cronEngine);
  app.listen(config.server.port, () => {
    console.log(`[http] listening on http://${config.server.host}:${config.server.port}`);
  });

  if (config.telegram.botToken) {
    telegram = new TelegramAdapter(config, runner, contextEngine, sessions, compactor);
    await telegram.launch();
  }

  console.log(`🤖 ${config.agent.name} is online.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
