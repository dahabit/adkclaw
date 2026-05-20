import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Config } from '../types/index.js';

interface AgentYaml {
  name?: string;
  tone?: string;
  traits?: string[];
}

function readEnv(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return fallback ?? '';
  }
  return v;
}

function readEnvNumber(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function readEnvList(key: string): string[] {
  const v = process.env[key];
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readAgentYaml(workspacePath: string): AgentYaml {
  const candidates = [
    resolve(dirname(workspacePath), 'agent.yaml'),
    resolve(workspacePath, 'agent.yaml'),
  ];
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = parseYaml(raw);
      if (parsed && typeof parsed === 'object') return parsed as AgentYaml;
    } catch {
      // try next
    }
  }
  return {};
}

export function loadConfig(): Config {
  const workspacePath = resolve(readEnv('WORKSPACE_PATH', './workspace'));
  const agentYaml = readAgentYaml(workspacePath);

  return {
    server: {
      port: readEnvNumber('PORT', 3000),
      host: readEnv('HOST', 'localhost'),
    },
    paths: {
      workspace: workspacePath,
      database: resolve(readEnv('DATABASE_PATH', './data/adkclaw.db')),
    },
    gemini: {
      apiKey: readEnv('GEMINI_API_KEY'),
      defaultModel: readEnv('DEFAULT_MODEL', 'gemini-3.1-pro-preview'),
      fallbackModel: readEnv('FALLBACK_MODEL', 'gemini-3-flash-preview'),
    },
    telegram: {
      botToken: readEnv('TELEGRAM_BOT_TOKEN'),
      allowedSenders: readEnvList('ALLOWED_SENDERS'),
    },
    agent: {
      name: agentYaml.name ?? 'AdkClaw',
      tone: agentYaml.tone ?? 'direct',
      traits: agentYaml.traits ?? [],
      maxToolRounds: readEnvNumber('MAX_TOOL_ROUNDS', 15),
      compactionThreshold: readEnvNumber('COMPACTION_THRESHOLD', 0.8),
      heartbeatIntervalMs: readEnvNumber('HEARTBEAT_INTERVAL_MS', 1_800_000),
      timezone: readEnv('TIMEZONE', 'UTC'),
      dailyTokenBudget: readEnvNumber('DAILY_TOKEN_BUDGET', 500_000),
    },
    vertex: {
      project: readEnv('GOOGLE_CLOUD_PROJECT') || null,
      region: readEnv('GOOGLE_CLOUD_REGION', 'us-central1'),
    },
  };
}

export interface ValidateOptions {
  allowMissingKeys?: boolean;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/**
 * Validates a loaded Config.
 *
 * Errors block daemon startup. Warnings are logged but allow boot — this is
 * deliberate for ALLOWED_SENDERS: a bot with an empty/invalid allowlist must
 * still launch so the /start command can give the user their numeric ID.
 */
export function validateConfig(config: Config, opts: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!opts.allowMissingKeys) {
    if (!config.gemini.apiKey) errors.push('GEMINI_API_KEY is required');
    if (!config.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN is required');

    if (config.telegram.allowedSenders.length === 0) {
      warnings.push(
        'ALLOWED_SENDERS is empty — the bot will reject every message except /start. ' +
          'Send /start to your bot to discover your numeric ID, then add it to .env.',
      );
    } else {
      const nonNumeric = config.telegram.allowedSenders.filter((s) => !/^\d+$/.test(s));
      if (nonNumeric.length > 0) {
        warnings.push(
          `ALLOWED_SENDERS contains non-numeric values that will be ignored: ${nonNumeric.join(', ')}. ` +
            `Send /start to your bot to get your numeric ID, then update .env.`,
        );
      }
    }
  }

  if (config.agent.maxToolRounds < 1 || config.agent.maxToolRounds > 100) {
    errors.push('MAX_TOOL_ROUNDS must be between 1 and 100');
  }
  if (config.agent.compactionThreshold <= 0 || config.agent.compactionThreshold >= 1) {
    errors.push('COMPACTION_THRESHOLD must be between 0 and 1');
  }
  if (config.agent.dailyTokenBudget < 1000) {
    errors.push('DAILY_TOKEN_BUDGET should be at least 1000');
  }

  return { errors, warnings };
}

/** Strips non-numeric Telegram IDs at runtime — keeps the allowlist clean. */
export function effectiveAllowedSenders(config: Config): string[] {
  return config.telegram.allowedSenders.filter((s) => /^\d+$/.test(s));
}
