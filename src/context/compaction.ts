import type { GoogleGenAI } from '@google/genai';
import type { SessionStore } from '../sessions/store.js';
import type { Message } from '../types/index.js';
import { estimateTokensInMessages } from './token-counter.js';

export const PRESERVATION_RULES = `
PRESERVATION RULES — when you summarize, you MUST preserve:
- All task IDs, URLs, file paths, opaque identifiers
- Active tasks and their current status
- The user's last request
- Decisions and the reasoning behind them
- TODOs, open questions, blockers
- Any pending approvals or asks
Discard chitchat, restated context, and repeated information.
`.trim();

export interface CompactorOptions {
  client: GoogleGenAI;
  sessions: SessionStore;
  /** Trigger threshold in tokens. Once active history exceeds this, compaction runs. */
  thresholdTokens: number;
  /** Fraction of oldest messages to summarize (default 0.6). */
  summarizeFraction?: number;
  /** Cheaper model used for summarization (e.g. gemini-2.5-flash). */
  summarizerModel: string;
}

export interface CompactionResult {
  tokensBefore: number;
  tokensAfter: number;
  summary: string;
  summarizedMessageCount: number;
}

/**
 * Compactor — summarizes old conversation turns when context grows beyond threshold.
 *
 * Strategy (BRD §6.4 + §19.1):
 *   1. Find messages since the last compaction checkpoint.
 *   2. If total tokens exceed threshold, take the oldest summarizeFraction of them.
 *   3. Send to Gemini Flash with explicit preservation rules.
 *   4. Persist a CompactionCheckpoint that links the summary to the messages it replaces.
 *   5. Future loads splice the summary in place of the summarized messages.
 *
 * Messages are NEVER deleted — the audit trail is intact (Paperclip pattern).
 * The summary is just a lens that lets the agent stay under context limit.
 */
export class Compactor {
  private readonly client: GoogleGenAI;
  private readonly sessions: SessionStore;
  private readonly thresholdTokens: number;
  private readonly summarizeFraction: number;
  private readonly summarizerModel: string;

  constructor(opts: CompactorOptions) {
    this.client = opts.client;
    this.sessions = opts.sessions;
    this.thresholdTokens = opts.thresholdTokens;
    this.summarizeFraction = opts.summarizeFraction ?? 0.6;
    this.summarizerModel = opts.summarizerModel;
  }

  shouldCompact(sessionKey: string): { compact: boolean; tokens: number; threshold: number } {
    const messages = this.activeMessages(sessionKey);
    const tokens = estimateTokensInMessages(messages);
    return { compact: tokens > this.thresholdTokens, tokens, threshold: this.thresholdTokens };
  }

  private activeMessages(sessionKey: string): Message[] {
    const checkpoint = this.sessions.getLatestCheckpoint(sessionKey);
    const sinceId =
      checkpoint && checkpoint.summarizedMessageIds.length > 0
        ? Math.max(...checkpoint.summarizedMessageIds)
        : 0;
    return this.sessions.listMessages(sessionKey, { sinceId });
  }

  async compact(sessionKey: string): Promise<CompactionResult | null> {
    const messages = this.activeMessages(sessionKey);
    if (messages.length < 4) return null;

    const tokensBefore = estimateTokensInMessages(messages);
    const splitIdx = Math.max(1, Math.floor(messages.length * this.summarizeFraction));
    const toSummarize = messages.slice(0, splitIdx);

    const transcript = toSummarize
      .map((m) => {
        if (m.role === 'tool') {
          const args = m.toolArgs ?? '{}';
          const result = (m.toolResult ?? '').slice(0, 600);
          return `[tool ${m.toolName}] args=${args} result=${result}`;
        }
        return `[${m.role}] ${m.content ?? ''}`;
      })
      .join('\n');

    const prompt = [
      'Summarize the following conversation transcript concisely.',
      '',
      PRESERVATION_RULES,
      '',
      '--- TRANSCRIPT ---',
      transcript,
      '--- END ---',
      '',
      'Return ONLY the summary, no preamble.',
    ].join('\n');

    let summary = '';
    try {
      const response = await this.client.models.generateContent({
        model: this.summarizerModel,
        contents: prompt,
      });
      summary = response.text ?? '';
    } catch (e) {
      summary = `[Compaction failed: ${e instanceof Error ? e.message : String(e)}.]`;
    }
    if (!summary.trim()) return null;

    const tokensAfter = Math.ceil(summary.length / 4);
    this.sessions.createCheckpoint({
      sessionKey,
      summary: summary.trim(),
      summarizedMessageIds: toSummarize.map((m) => m.id),
      tokensBefore,
      tokensAfter,
    });

    return {
      tokensBefore,
      tokensAfter,
      summary: summary.trim(),
      summarizedMessageCount: toSummarize.length,
    };
  }
}
