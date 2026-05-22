export type SessionKind = 'main' | 'isolated';

export interface Session {
  key: string;
  kind: SessionKind;
  parentKey: string | null;
  channel: string | null;
  target: string | null;
  senderId: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  model: string;
  totalTokens: number;
  isArchived: boolean;
}

export interface SessionCreateInput {
  key: string;
  kind?: SessionKind;
  parentKey?: string | null;
  channel?: string | null;
  target?: string | null;
  senderId?: string | null;
  model?: string;
}
