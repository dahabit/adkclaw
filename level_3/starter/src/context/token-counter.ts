// src/context/token-counter.ts
//
// Heuristic token counting — chars / 4. Good enough for compaction thresholds
// and budget guards. For exact counts, swap in client.models.countTokens().
import type { Content } from '@google/genai';

export function estimateTokens(text: string | null | undefined): number {
  //REPLACE-CONTEXT-TOKENS
  // From level_3/codelab.md §3 "Compaction" (token-counter helper).
  throw new Error('REPLACE-CONTEXT-TOKENS not implemented — see level_3/codelab.md §3');
}

export function estimateTokensInHistory(history: Content[]): number {
  //REPLACE-CONTEXT-TOKENS
  // From level_3/codelab.md §3 "Compaction" (token-counter helper).
  throw new Error('REPLACE-CONTEXT-TOKENS not implemented — see level_3/codelab.md §3');
}
