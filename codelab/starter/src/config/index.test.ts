import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { loadConfig, validateConfig } from './index.js';

const SNAPSHOT = { ...process.env };
const RESET_KEYS = [
  'GEMINI_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'ALLOWED_SENDERS',
  'PORT',
  'MAX_TOOL_ROUNDS',
  'COMPACTION_THRESHOLD',
  'DAILY_TOKEN_BUDGET',
  'GOOGLE_CLOUD_PROJECT',
];

function resetEnv(): void {
  for (const k of RESET_KEYS) delete process.env[k];
}

describe('config', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterAll(() => {
    process.env = SNAPSHOT;
  });

  it('returns defaults when env vars missing', () => {
    const c = loadConfig();
    expect(c.server.port).toBe(3000);
    expect(c.agent.maxToolRounds).toBe(15);
    expect(c.agent.compactionThreshold).toBe(0.8);
    expect(c.gemini.defaultModel).toBe('gemini-3.1-pro-preview');
    expect(c.gemini.fallbackModel).toBe('gemini-3-flash-preview');
    expect(c.vertex.project).toBeNull();
  });

  it('parses ALLOWED_SENDERS as comma-separated list', () => {
    process.env.ALLOWED_SENDERS = '12345, 67890 ,11111';
    const c = loadConfig();
    expect(c.telegram.allowedSenders).toEqual(['12345', '67890', '11111']);
  });

  it('validateConfig flags missing required keys', () => {
    const c = loadConfig();
    const { errors, warnings } = validateConfig(c);
    expect(errors).toContain('GEMINI_API_KEY is required');
    expect(errors).toContain('TELEGRAM_BOT_TOKEN is required');
    expect(warnings.some((w) => w.includes('ALLOWED_SENDERS'))).toBe(true);
  });

  it('validateConfig with allowMissingKeys skips required-key checks', () => {
    const c = loadConfig();
    const { errors } = validateConfig(c, { allowMissingKeys: true });
    expect(errors.find((e) => e.includes('GEMINI_API_KEY'))).toBeUndefined();
    expect(errors.find((e) => e.includes('TELEGRAM_BOT_TOKEN'))).toBeUndefined();
  });

  it('validateConfig warns (not errors) on non-numeric ALLOWED_SENDERS', () => {
    process.env.GEMINI_API_KEY = 'x';
    process.env.TELEGRAM_BOT_TOKEN = 'y';
    process.env.ALLOWED_SENDERS = 'dahabdev,12345';
    const c = loadConfig();
    const { errors, warnings } = validateConfig(c);
    expect(errors.length).toBe(0);
    expect(warnings.some((w) => w.includes('dahabdev'))).toBe(true);
  });

  it('falls back to defaults when numeric env values are invalid', () => {
    process.env.MAX_TOOL_ROUNDS = 'not a number';
    const c = loadConfig();
    expect(c.agent.maxToolRounds).toBe(15);
  });

  it('validates threshold ranges', () => {
    process.env.GEMINI_API_KEY = 'x';
    process.env.TELEGRAM_BOT_TOKEN = 'y';
    process.env.ALLOWED_SENDERS = '1';
    process.env.COMPACTION_THRESHOLD = '1.5';
    const c = loadConfig();
    const { errors } = validateConfig(c);
    expect(errors.some((e) => e.includes('COMPACTION_THRESHOLD'))).toBe(true);
  });
});
