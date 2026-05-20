// src/cron/heartbeat.ts
//
// Periodic wake-up loop. Every intervalMs (outside quiet hours) the agent
// reads HEARTBEAT.md and acts on any open tasks — staying silent unless
// something genuinely useful happened.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { SessionStore } from '../sessions/store.js';
import type { DeliveryFn } from './types.js';

const HEARTBEAT_PROMPT = [
  'HEARTBEAT — read your HEARTBEAT.md tasks (already in your system prompt).',
  'For each task: decide if action is needed RIGHT NOW. Run any tools needed.',
  'Stay silent unless something useful for the user actually happened.',
  'If nothing to report, respond with exactly the literal: HEARTBEAT_OK',
].join('\n');

export interface HeartbeatOptions {
  runner: AgentRunner;
  sessions: SessionStore;
  contextEngine: ContextEngine;
  workspacePath: string;
  intervalMs: number;
  model: string;
  sessionKey?: string;
  channel?: string;
  target?: string;
  delivery?: DeliveryFn;
  /** Quiet hours (24h, local). E.g. { start: 22, end: 7 } silences 10pm-7am. */
  quietHours?: { start: number; end: number };
}

export class Heartbeat {
  private readonly runner: AgentRunner;
  private readonly sessions: SessionStore;
  private readonly contextEngine: ContextEngine;
  private readonly workspacePath: string;
  private readonly intervalMs: number;
  private readonly model: string;
  private readonly sessionKey: string;
  private readonly channel?: string;
  private readonly target?: string;
  private readonly delivery?: DeliveryFn;
  private readonly quietHours?: { start: number; end: number };
  private timer: NodeJS.Timeout | null = null;

  constructor(opts: HeartbeatOptions) {
    this.runner = opts.runner;
    this.sessions = opts.sessions;
    this.contextEngine = opts.contextEngine;
    this.workspacePath = opts.workspacePath;
    this.intervalMs = opts.intervalMs;
    this.model = opts.model;
    this.sessionKey = opts.sessionKey ?? 'heartbeat:default';
    if (opts.channel) this.channel = opts.channel;
    if (opts.target) this.target = opts.target;
    if (opts.delivery) this.delivery = opts.delivery;
    if (opts.quietHours) this.quietHours = opts.quietHours;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isQuietHour(now = new Date()): boolean {
    if (!this.quietHours) return false;
    const h = now.getHours();
    const { start, end } = this.quietHours;
    if (start === end) return false;
    if (start < end) return h >= start && h < end;
    return h >= start || h < end; // wraps midnight
  }

  async tick(): Promise<{ fired: boolean; reason?: string; reply?: string }> {
    if (this.isQuietHour()) return { fired: false, reason: 'quiet hours' };

    const heartbeatPath = resolve(this.workspacePath, 'HEARTBEAT.md');
    if (!existsSync(heartbeatPath)) return { fired: false, reason: 'no HEARTBEAT.md' };
    const content = await readFile(heartbeatPath, 'utf8').catch(() => '');
    const stripped = content.replace(/_\(nothing yet[^)]*\)_/g, '').trim();
    if (!stripped || stripped.split(/\n/).every((l) => !l.trim() || l.startsWith('#'))) {
      return { fired: false, reason: 'no scheduled tasks' };
    }

    const session = this.sessions.ensureSession(
      this.sessionKey,
      this.channel ?? 'heartbeat',
      this.target ?? null,
      this.model,
    );
    const history = this.sessions.history(this.sessionKey);
    const result = await this.runner.run({
      session,
      systemPrompt: this.contextEngine.bootstrap().systemPrompt,
      history,
      userText: HEARTBEAT_PROMPT,
    });
    this.sessions.appendAll(this.sessionKey, result.newHistory.slice(history.length));

    const reply = result.reply.trim();
    if (!reply || /^heartbeat_ok$/i.test(reply))
      return { fired: true, reason: 'silent', reply: '' };

    if (this.delivery && this.channel && this.target) {
      try {
        await this.delivery(this.channel, this.target, reply);
      } catch (e) {
        return { fired: true, reason: `delivery failed: ${e instanceof Error ? e.message : e}` };
      }
    }
    return { fired: true, reply };
  }
}
