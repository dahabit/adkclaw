// src/context/compaction.ts
//
// When a conversation grows past a token threshold, summarize the oldest turns
// with a cheap model and splice the summary in place of them. Recent turns —
// the context the agent actually needs — are kept verbatim.
import type { GoogleGenAI, Content } from '@google/genai';
import type { SessionStore } from '../sessions/store.js';
import { estimateTokensInHistory } from './token-counter.js';

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
  /** Once active history exceeds this many tokens, compaction runs. */
  thresholdTokens: number;
  /** Cheaper model used for summarization (e.g. gemini-3-flash-preview). */
  summarizerModel: string;
  /** Fraction of the oldest turns to summarize (default 0.6). */
  summarizeFraction?: number;
}

export interface CompactionResult {
  tokensBefore: number;
  tokensAfter: number;
  summary: string;
  summarizedMessageCount: number;
}

function contentToLine(c: Content): string {
  const role = c.role ?? 'user';
  const text = (c.parts ?? [])
    .map((p) => {
      if (typeof p.text === 'string') return p.text;
      if (p.functionCall) return `[tool call: ${p.functionCall.name}]`;
      if (p.functionResponse) return `[tool result]`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
  return `${role}: ${text}`;
}

export class Compactor {
  private readonly client: GoogleGenAI;
  private readonly sessions: SessionStore;
  private readonly thresholdTokens: number;
  private readonly summarizerModel: string;
  private readonly summarizeFraction: number;

  constructor(opts: CompactorOptions) {
    this.client = opts.client;
    this.sessions = opts.sessions;
    this.thresholdTokens = opts.thresholdTokens;
    this.summarizerModel = opts.summarizerModel;
    this.summarizeFraction = opts.summarizeFraction ?? 0.6;
  }

  // Summarize the oldest turns if the session is over threshold. Returns null
  // when no compaction was needed.
  async maybeCompact(sessionKey: string): Promise<CompactionResult | null> {
    const history = this.sessions.history(sessionKey);
    const tokensBefore = estimateTokensInHistory(history);
    if (tokensBefore < this.thresholdTokens || history.length < 4) return null;

    const cutoff = Math.max(1, Math.floor(history.length * this.summarizeFraction));
    const oldest = history.slice(0, cutoff);
    const transcript = oldest.map(contentToLine).join('\n');

    let summary = '';
    try {
      const response = await this.client.models.generateContent({
        model: this.summarizerModel,
        contents: `${PRESERVATION_RULES}\n\nCONVERSATION TO SUMMARIZE:\n${transcript}`,
      });
      summary = (response.text ?? '').trim();
    } catch (e) {
      summary = `[Compaction failed: ${e instanceof Error ? e.message : String(e)}]`;
    }
    if (!summary) return null;

    this.sessions.replaceWithSummary(sessionKey, cutoff, summary);
    const tokensAfter = estimateTokensInHistory(this.sessions.history(sessionKey));
    return { tokensBefore, tokensAfter, summary, summarizedMessageCount: cutoff };
  }
}
