/**
 * src/tools/badge.ts — `mark_level_complete` tool
 *
 * Exposes the BadgeReporter as a Gemini-callable tool. The agent invokes this
 * itself when it detects a level milestone — e.g., user says "I just deployed",
 * or the agent observes its own successful operation matching the level criteria.
 *
 * Wired into src/index.ts registry. Auto-disabled when ADKCLAW_USERNAME or
 * ADKCLAW_BUILDER_SECRET aren't set in .env (the tool description still surfaces
 * but the execute() returns a clear "not configured" error instead of failing
 * obscurely).
 */

import type { AgentTool } from '../types/index.js';
import { BadgeReporter, type BadgePayload } from '../lib/badge-reporter.js';

export interface MakeBadgeToolOptions {
  reporter?: BadgeReporter;
}

export function makeBadgeTool(opts: MakeBadgeToolOptions = {}): AgentTool {
  const reporter = opts.reporter ?? new BadgeReporter();

  return {
    name: 'mark_level_complete',
    description:
      'Report completion of an AdkClaw workshop level (1-4) to the public ' +
      'workshop platform at adkclaw.dev. Call this when YOU have verified the ' +
      "level's deliverables are working — e.g., you successfully responded to " +
      'a Telegram message (L1), recalled a memory across restarts (L2), spawned ' +
      'a sub-agent (L3), or were deployed to Cloud Run (L4). The platform ' +
      "lights up the builder's beacon on the cohort fleet view. Idempotent — " +
      'only the first call per level counts.',
    permission: 'allow',
    parameters: {
      type: 'object',
      properties: {
        level: {
          type: 'number',
          enum: [1, 2, 3, 4],
          description: 'Workshop level being marked complete (1=Brain, 2=Memory, 3=Army, 4=Cloud).',
        },
        agent_name: {
          type: 'string',
          description: "Optional: your agent's name (e.g., 'Dudu') if known. Set on first badge.",
        },
        region: {
          type: 'string',
          description:
            'Optional: Cloud Run region for Level 4 (e.g., us-central1). Required for L4.',
        },
        public_agent_url: {
          type: 'string',
          description:
            'Optional: your deployed agent URL for Level 4 (e.g., https://your-agent.run.app).',
        },
        evidence: {
          type: 'string',
          description:
            'Optional: human-readable proof of completion (max 500 chars). E.g., "Persisted SQLite session across restart and recalled user name."',
        },
      },
      required: ['level'],
    },
    async execute(args) {
      if (!reporter.isEnabled()) {
        return {
          error:
            'mark_level_complete is not configured. Add ADKCLAW_USERNAME and ' +
            'ADKCLAW_BUILDER_SECRET to .env (register at https://adkclaw.dev/join/sandbox).',
        };
      }

      const level = Number(args['level']);
      if (![1, 2, 3, 4].includes(level)) {
        return { error: `Invalid level: ${args['level']} (must be 1-4)` };
      }

      const payload: BadgePayload = { level: level as 1 | 2 | 3 | 4 };
      if (typeof args['agent_name'] === 'string' && args['agent_name'].trim()) {
        payload.agentName = args['agent_name'].trim();
      }
      if (typeof args['region'] === 'string' && args['region'].trim()) {
        payload.region = args['region'].trim();
      }
      if (typeof args['public_agent_url'] === 'string' && args['public_agent_url'].trim()) {
        payload.publicAgentUrl = args['public_agent_url'].trim();
      }
      if (typeof args['evidence'] === 'string' && args['evidence'].trim()) {
        payload.evidence = args['evidence'].slice(0, 500);
      }

      // L4 requires region per the platform's expectation
      if (payload.level === 4 && !payload.region) {
        return {
          error: 'Level 4 requires a region argument (e.g., region="us-central1")',
        };
      }

      const reportResult = await reporter.report(payload);
      if (reportResult.ok) {
        return {
          success: true,
          result:
            `Badge L${payload.level} reported to adkclaw.dev. Total badges earned: [${(reportResult.badgesEarned || []).join(', ')}]. ` +
            `View profile at https://adkclaw.dev/u/${process.env['ADKCLAW_USERNAME'] || ''}`,
        };
      }
      return {
        error: `Badge report failed: ${reportResult.reason}`,
      };
    },
  };
}
