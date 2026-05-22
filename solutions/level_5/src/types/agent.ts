export interface AgentRequest {
  sessionKey: string;
  message: string;
  channel?: string;
  target?: string;
  senderId?: string;
  extraSystemPrompt?: string;
  model?: string;
  timeoutMs?: number;
  /** If set, only tools whose name is in this list are exposed to the model for this turn. Used by sub-agent profiles to restrict capabilities. */
  allowedToolNames?: string[];
}

export type FinishReason = 'completed' | 'max_rounds' | 'error' | 'cancelled' | 'budget_exceeded';

export interface AgentResponse {
  text: string;
  toolCallCount: number;
  tokensUsed: number;
  durationMs: number;
  finishReason: FinishReason;
  error?: string;
}
