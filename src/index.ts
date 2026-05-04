import { GoogleGenAI } from '@google/genai';
import { loadConfig, validateConfig } from './config/index.js';
import { SessionStore } from './sessions/store.js';
import { ContextEngine } from './context/manager.js';
import { ToolRegistry } from './tools/registry.js';
import { filesystemTool, shellTool, webSearchTool, webFetchTool } from './tools/index.js';
import { makeMemorySaveTool, makeMemoryRecallTool, makeDailyAppendTool } from './tools/memory.js';
import { makeLoadSkillTool, makeListSkillsTool } from './tools/skills.js';
import {
  makeTextCreateTool,
  makePresentationCreateTool,
  makePdfCreateTool,
} from './tools/content.js';
import {
  makeBrowserFetchTool,
  makeBrowserScreenshotTool,
  makeBrowserPdfTool,
} from './tools/browser.js';
import { makeCodeFixTool } from './tools/code-fix.js';
import {
  makeSpawnAgentTool,
  makeSpawnSearchTool,
  makeSpawnCommunicatorTool,
  makeSpawnResearcherTool,
  makeSpawnCoderTool,
} from './tools/spawn.js';
import { AgentRunner } from './agent/runner.js';
import { BudgetGuard } from './agent/budget.js';
import { HealingEngine } from './healing/index.js';
import { MultiAgentOrchestrator } from './multi-agent/orchestrator.js';
import { CronEngine, Heartbeat } from './cron/index.js';
import {
  makeCronAddTool,
  makeCronRemoveTool,
  makeCronListTool,
  makeMessageUserTool,
} from './tools/cron.js';
import type { DeliveryFn } from './cron/types.js';
import { TelegramAdapter } from './channels/telegram.js';
import { createHttpServer } from './server/http.js';

async function main() {
  const config = loadConfig();
  const { errors, warnings } = validateConfig(config);
  if (errors.length > 0) {
    console.error('🤖 AdkClaw cannot start — configuration errors:');
    for (const e of errors) console.error(`  - ${e}`);
    console.error('\nFix your .env (run `adkclaw setup` to (re)generate it) and try again.');
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings (daemon will start but with reduced functionality):');
    for (const w of warnings) console.warn(`  - ${w}`);
    console.warn('');
  }

  console.log(`🤖 AdkClaw starting...`);
  console.log(`   Agent: ${config.agent.name} (tone: ${config.agent.tone})`);
  console.log(`   Model: ${config.gemini.defaultModel} (fallback: ${config.gemini.fallbackModel})`);
  console.log(`   Workspace: ${config.paths.workspace}`);

  const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const sessions = new SessionStore({
    databasePath: config.paths.database,
    defaultModel: config.gemini.defaultModel,
  });
  const contextEngine = new ContextEngine({ workspacePath: config.paths.workspace });
  const registry = new ToolRegistry();
  registry.register(filesystemTool);
  registry.register(shellTool);
  registry.register(webSearchTool);
  registry.register(webFetchTool);
  registry.register(makeMemorySaveTool());
  registry.register(makeMemoryRecallTool());
  registry.register(makeDailyAppendTool());
  registry.register(makeLoadSkillTool());
  registry.register(makeListSkillsTool());
  registry.register(makeTextCreateTool());
  registry.register(makePresentationCreateTool());
  registry.register(makePdfCreateTool());
  registry.register(makeBrowserFetchTool());
  registry.register(makeBrowserScreenshotTool());
  registry.register(makeBrowserPdfTool());
  registry.register(makeCodeFixTool());

  const healing = new HealingEngine();
  const budget = new BudgetGuard({
    sessions,
    dailyTokenBudget: config.agent.dailyTokenBudget,
  });
  const runner = new AgentRunner({
    client,
    sessions,
    contextEngine,
    registry,
    config,
    healing,
    budget,
    callbacks: {
      beforeTurn: (s, msg) => {
        console.log(`[${s.key}] ▸ ${msg.slice(0, 120)}`);
      },
      afterTurn: (s, response) => {
        const reason = response.finishReason;
        const tokens = response.tokensUsed;
        const tools = response.toolCallCount;
        console.log(
          `[${s.key}] ◂ ${response.text.slice(0, 120)} (${reason}, ${tools} tools, ${tokens} tokens, ${response.durationMs}ms)`,
        );
      },
      beforeTool: (name, args) => {
        const preview = JSON.stringify(args).slice(0, 80);
        console.log(`  → tool ${name}(${preview})`);
      },
      afterTool: (trace) => {
        console.log(
          `  ← tool ${trace.toolName} ${trace.ok ? '✓' : '✗'} ${trace.preview.slice(0, 80)}`,
        );
      },
      onError: (err, ctx) => {
        console.error(`  ✗ runner error in ${ctx.phase}:`, err.message);
      },
    },
  });

  const orchestrator = new MultiAgentOrchestrator({ runner, sessions, config });
  registry.register(makeSpawnAgentTool(orchestrator));
  registry.register(makeSpawnSearchTool(orchestrator));
  registry.register(makeSpawnCommunicatorTool(orchestrator));
  registry.register(makeSpawnResearcherTool(orchestrator));
  registry.register(makeSpawnCoderTool(orchestrator));

  const app = createHttpServer({ config, runner, sessions });
  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`   HTTP: http://${config.server.host}:${config.server.port}`);
  });

  let telegram: TelegramAdapter | null = null;
  if (config.telegram.botToken) {
    telegram = new TelegramAdapter({ config, runner });
    await telegram.launch();
    console.log(
      `   Telegram: bot is online (allowed senders: ${config.telegram.allowedSenders.join(', ') || 'none'})`,
    );
  }

  const delivery: DeliveryFn = async (channel, target, text) => {
    if (channel === 'telegram' && telegram) {
      await telegram.deliver(target, text);
      return;
    }
    console.log(`[delivery:${channel}:${target}] ${text}`);
  };

  const cronEngine = new CronEngine({
    runner,
    sessions,
    db: sessions.getDatabase(),
    delivery,
  });
  cronEngine.start();
  registry.register(makeCronAddTool(cronEngine));
  registry.register(makeCronRemoveTool(cronEngine));
  registry.register(makeCronListTool(cronEngine));
  registry.register(makeMessageUserTool(delivery));
  console.log(`   Cron: ${cronEngine.list().length} job(s) loaded`);

  const heartbeat = new Heartbeat({
    runner,
    workspacePath: config.paths.workspace,
    intervalMs: config.agent.heartbeatIntervalMs,
    sessionKey: 'heartbeat:default',
    delivery,
    quietHours: { start: 22, end: 7 },
  });
  if (config.agent.heartbeatIntervalMs > 0) {
    heartbeat.start();
    console.log(
      `   Heartbeat: every ${config.agent.heartbeatIntervalMs / 60000} min (quiet 22:00-07:00)`,
    );
  }

  console.log(`\n🤖 AdkClaw is online. Send messages on Telegram or run \`npm run chat\`.\n`);

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down...`);
    heartbeat.stop();
    cronEngine.stop();
    telegram?.stop(signal);
    server.close();
    sessions.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
