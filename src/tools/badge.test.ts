/**
 * Unit tests for mark_level_complete tool.
 */

import { describe, it, expect, vi } from 'vitest';
import { makeBadgeTool } from './badge.js';
import { BadgeReporter } from '../lib/badge-reporter.js';
import type { ToolContext, Session, Config } from '../types/index.js';

const fakeSession: Session = {
  key: 'test:1',
  kind: 'main',
  parentKey: null,
  channel: 'cli',
  target: 'test',
  senderId: 'test',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastMessageAt: null,
  model: 'gemini-2.5-pro',
  totalTokens: 0,
  isArchived: false,
};

const fakeConfig = { agent: { name: 'Test' } } as unknown as Config;

const ctx: ToolContext = {
  session: fakeSession,
  workspacePath: '/tmp/ws',
  config: fakeConfig,
};

function mockReporter(
  opts: {
    enabled?: boolean;
    reportResult?: { ok: boolean; badgesEarned?: number[]; reason?: string };
  } = {},
) {
  const r = new BadgeReporter({ logger: () => {} });
  vi.spyOn(r, 'isEnabled').mockReturnValue(opts.enabled ?? true);
  if (opts.reportResult) {
    vi.spyOn(r, 'report').mockResolvedValue(opts.reportResult);
  }
  return r;
}

describe('mark_level_complete tool', () => {
  it('has the expected metadata', () => {
    const tool = makeBadgeTool({ reporter: mockReporter() });
    expect(tool.name).toBe('mark_level_complete');
    expect(tool.permission).toBe('allow');
    expect(tool.description.length).toBeGreaterThan(50);
  });

  it('returns config error when reporter disabled', async () => {
    const tool = makeBadgeTool({ reporter: mockReporter({ enabled: false }) });
    const result = await tool.execute({ level: 1 }, ctx);
    expect(result.error).toMatch(/not configured/);
  });

  it('rejects invalid level', async () => {
    const tool = makeBadgeTool({ reporter: mockReporter() });
    const result = await tool.execute({ level: 5 }, ctx);
    expect(result.error).toMatch(/Invalid level/);
  });

  it('rejects level=0 (intro)', async () => {
    const tool = makeBadgeTool({ reporter: mockReporter() });
    const result = await tool.execute({ level: 0 }, ctx);
    expect(result.error).toMatch(/Invalid level/);
  });

  it('reports valid L1 badge successfully', async () => {
    const reporter = mockReporter({ reportResult: { ok: true, badgesEarned: [1] } });
    const tool = makeBadgeTool({ reporter });

    const result = await tool.execute({ level: 1, agent_name: 'Dudu' }, ctx);
    expect(result.success).toBe(true);
    expect(result.result).toContain('L1 reported');
    expect(reporter.report).toHaveBeenCalledWith({ level: 1, agentName: 'Dudu' });
  });

  it('requires region for L4', async () => {
    const tool = makeBadgeTool({ reporter: mockReporter() });
    const result = await tool.execute({ level: 4 }, ctx);
    expect(result.error).toMatch(/Level 4 requires a region/);
  });

  it('accepts L4 with full payload', async () => {
    const reporter = mockReporter({ reportResult: { ok: true, badgesEarned: [1, 2, 3, 4] } });
    const tool = makeBadgeTool({ reporter });

    const result = await tool.execute(
      {
        level: 4,
        agent_name: 'Dudu',
        region: 'us-central1',
        public_agent_url: 'https://adkclaw-abc.run.app',
        evidence: 'Deployed via gcloud run deploy',
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(reporter.report).toHaveBeenCalledWith({
      level: 4,
      agentName: 'Dudu',
      region: 'us-central1',
      publicAgentUrl: 'https://adkclaw-abc.run.app',
      evidence: 'Deployed via gcloud run deploy',
    });
  });

  it('truncates evidence to 500 chars', async () => {
    const reporter = mockReporter({ reportResult: { ok: true, badgesEarned: [1] } });
    const tool = makeBadgeTool({ reporter });
    const longEvidence = 'x'.repeat(1000);

    await tool.execute({ level: 1, evidence: longEvidence }, ctx);
    const callArg = (reporter.report as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.evidence?.length).toBe(500);
  });

  it('passes through reporter rejection', async () => {
    const reporter = mockReporter({
      reportResult: { ok: false, reason: 'invalid_secret' },
    });
    const tool = makeBadgeTool({ reporter });

    const result = await tool.execute({ level: 1 }, ctx);
    expect(result.error).toMatch(/invalid_secret/);
  });

  it('ignores empty/whitespace optional strings', async () => {
    const reporter = mockReporter({ reportResult: { ok: true, badgesEarned: [1] } });
    const tool = makeBadgeTool({ reporter });

    await tool.execute(
      {
        level: 1,
        agent_name: '   ',
        region: '',
        evidence: '',
      },
      ctx,
    );
    const callArg = (reporter.report as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.agentName).toBeUndefined();
    expect(callArg?.region).toBeUndefined();
    expect(callArg?.evidence).toBeUndefined();
  });
});
