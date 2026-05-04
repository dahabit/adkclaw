import type { Message } from '../types/index.js';

/**
 * Heuristic token count — chars / 4. For accuracy, install `tiktoken` and swap.
 * For our purposes (compaction trigger, budget guard), the heuristic is sufficient.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateTokensInMessages(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content);
    total += estimateTokens(m.toolArgs);
    total += estimateTokens(m.toolResult);
  }
  return total;
}
