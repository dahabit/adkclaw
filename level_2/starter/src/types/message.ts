export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: number;
  sessionKey: string;
  role: MessageRole;
  content: string | null;
  toolName: string | null;
  toolArgs: string | null;
  toolResult: string | null;
  tokens: number | null;
  metadata: string | null;
  createdAt: number;
}

export interface MessageInput {
  sessionKey: string;
  role: MessageRole;
  content?: string | null;
  toolName?: string | null;
  toolArgs?: unknown;
  toolResult?: unknown;
  tokens?: number | null;
  metadata?: Record<string, unknown> | null;
}
