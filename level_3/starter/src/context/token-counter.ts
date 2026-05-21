// src/context/token-counter.ts
//
// Heuristic token counting — chars / 4. Good enough for compaction thresholds
// and budget guards. For exact counts, swap in client.models.countTokens().
import type { Content } from '@google/genai';

export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateTokensInHistory(history: Content[]): number {
  let total = 0;
  for (const c of history) {
    for (const part of c.parts ?? []) {
      if (typeof part.text === 'string') total += estimateTokens(part.text);
      if (part.functionCall) total += estimateTokens(JSON.stringify(part.functionCall));
      if (part.functionResponse) total += estimateTokens(JSON.stringify(part.functionResponse));
    }
  }
  return total;
}
