// src/server/http.ts
import express, { type Express } from 'express';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';

//REPLACE-SERVER-HTTP
export function createHttpServer(
  config: Config,
  runner: AgentRunner,
  contextEngine: ContextEngine,
  sessions: SessionStore,
): Express {
  // Create an Express app with /api/health and /api/chat routes.
  // Fill this in from level_1/codelab.md §6.
  throw new Error('REPLACE-SERVER-HTTP not implemented — see level_1/codelab.md §6');
}
