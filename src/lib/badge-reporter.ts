/**
 * src/lib/badge-reporter.ts — Agent → Platform badge reporter
 *
 * When the agent reaches a level milestone (Level 1: first conversation; Level 2:
 * memory bank populated; Level 3: sub-agent spawned; Level 4: deployed to Cloud Run),
 * it POSTs an HMAC-signed badge to the workshop platform at adkclaw.dev.
 *
 * The platform uses this to:
 *   - Light up the builder's beacon on the cohort fleet view
 *   - Update the builder's profile at adkclaw.dev/u/<username>
 *   - Track time-to-completion for the leaderboard
 *
 * AUTH: HMAC-SHA256 over "<level>:<ISO timestamp>" with the builder's pre-shared
 * secret. The secret is issued ONCE at registration (adkclaw.dev/join/<event>) and
 * stored locally in the agent's `.env` as ADKCLAW_BUILDER_SECRET.
 *
 * IDEMPOTENCY: the platform deduplicates same-level POSTs from the same builder.
 * Safe to call multiple times — only the first counts.
 *
 * NETWORK: best-effort. Failures are logged but never thrown — the agent keeps
 * running even if the platform is unreachable. This is a side-channel, not a
 * critical path.
 */

import crypto from 'node:crypto';

export interface BadgeReporterOptions {
  apiBase?: string; // defaults to https://api.adkclaw.dev
  username?: string; // ADKCLAW_USERNAME from .env
  secret?: string; // ADKCLAW_BUILDER_SECRET from .env
  enabled?: boolean; // false to disable (e.g., when not registered)
  logger?: (msg: string) => void; // optional logger; defaults to console
}

export interface BadgePayload {
  level: 0 | 1 | 2 | 3 | 4;
  agentName?: string;
  region?: string; // e.g., 'us-central1' (Level 4)
  publicAgentUrl?: string; // e.g., 'https://adkclaw-abc.run.app' (Level 4)
  evidence?: string; // optional human-readable proof
}

export interface BadgeReportResult {
  ok: boolean;
  badgesEarned?: number[];
  reason?: string;
}

const DEFAULT_API_BASE = 'https://api.adkclaw.dev';

export class BadgeReporter {
  private readonly enabled: boolean;
  private readonly apiBase: string;
  private readonly username: string | null;
  private readonly secret: string | null;
  private readonly log: (msg: string) => void;

  constructor(opts: BadgeReporterOptions = {}) {
    this.apiBase = opts.apiBase || process.env['ADKCLAW_API_BASE'] || DEFAULT_API_BASE;
    this.username = opts.username || process.env['ADKCLAW_USERNAME'] || null;
    this.secret = opts.secret || process.env['ADKCLAW_BUILDER_SECRET'] || null;
    this.log = opts.logger || ((m) => console.log(`[badge-reporter] ${m}`));

    // Auto-disable if missing credentials (graceful — agent runs fine without reporting)
    this.enabled = opts.enabled !== false && Boolean(this.username) && Boolean(this.secret);

    if (!this.enabled) {
      const reason = !this.username
        ? 'no ADKCLAW_USERNAME'
        : !this.secret
          ? 'no ADKCLAW_BUILDER_SECRET'
          : 'disabled';
      this.log(`disabled (${reason}) — agent will not post badges to ${this.apiBase}`);
    } else {
      this.log(`enabled — will report as @${this.username} to ${this.apiBase}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Reports a level completion to the workshop platform.
   * Best-effort: logs failures, never throws.
   */
  async report(payload: BadgePayload): Promise<BadgeReportResult> {
    if (!this.enabled || !this.username || !this.secret) {
      return { ok: false, reason: 'disabled' };
    }

    const timestampIso = new Date().toISOString();
    const message = `${payload.level}:${timestampIso}`;
    const signature = crypto.createHmac('sha256', this.secret).update(message).digest('hex');

    const url = `${this.apiBase}/api/builders/${encodeURIComponent(this.username)}/badge`;
    const body: Record<string, unknown> = { level: payload.level };
    if (payload.agentName) body['agentName'] = payload.agentName;
    if (payload.region) body['region'] = payload.region;
    if (payload.publicAgentUrl) body['publicAgentUrl'] = payload.publicAgentUrl;
    if (payload.evidence) body['evidence'] = payload.evidence;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `HMAC ${signature}`,
          'X-Builder': this.username,
          'X-Builder-Secret': this.secret,
          'X-Timestamp': timestampIso,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        this.log(`badge L${payload.level} rejected: ${json.error || res.status}`);
        return { ok: false, reason: json.error || `http_${res.status}` };
      }

      this.log(
        `✓ badge L${payload.level} accepted ` +
          `(earned: [${(json.badgesEarned || []).join(', ')}])`,
      );
      return { ok: true, badgesEarned: json.badgesEarned };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`badge L${payload.level} network error: ${msg}`);
      return { ok: false, reason: msg };
    }
  }

  /**
   * One-shot helper for level milestones. Call from the agent's runner when
   * specific events are detected. Reports run in the background — caller
   * doesn't wait.
   */
  fireAndForget(payload: BadgePayload): void {
    if (!this.enabled) return;
    this.report(payload).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`fire-and-forget error: ${msg}`);
    });
  }
}
