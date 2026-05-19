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

//REPLACE-MAIN-ENTRY
async function main(): Promise<void> {
  // Load config, create the Gemini client, register tools, wire the channels,
  // and start the HTTP server and optional Telegram bot.
  // Fill this in from level_1/codelab.md §6.
  throw new Error('REPLACE-MAIN-ENTRY not implemented — see level_1/codelab.md §6');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
