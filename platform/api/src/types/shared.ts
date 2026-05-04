/**
 * Shared types between platform/api and platform/frontend.
 * Single source of truth for the platform's data model.
 *
 * Mirrored Firestore collections:
 *  - events
 *  - builders
 *  - level_completions
 *  - regions
 */

export type LevelId = 0 | 1 | 2 | 3 | 4;

export type AvatarPreset =
  | 'chrome'
  | 'bronze'
  | 'slate'
  | 'cosmic'
  | 'nova'
  | 'onyx'
  | 'pine'
  | 'ember'
  | 'mint'
  | 'coral'
  | 'sky'
  | 'gold'
  | 'lavender'
  | 'forest'
  | 'sunset'
  | 'arctic';

export type BuilderStatus = 'idle' | 'building' | 'deployed';

export type EventStatus = 'open' | 'closed';

export interface Event {
  code: string; // primary key — e.g. 'agentcon2026' or 'sandbox'
  name: string;
  status: EventStatus;
  startsAt: string; // ISO 8601
  endsAt: string;
  capacity: number;
  isPublic: boolean; // sandbox = true
  createdAt: string;
  createdBy: string;
}

export interface Builder {
  username: string; // primary key
  eventCode: string;
  avatarPreset: AvatarPreset;
  agentName: string | null;
  region: string | null; // e.g. 'us-central1'
  publicAgentUrl: string | null;
  publicTelegramHandle: string | null;
  status: BuilderStatus;
  registeredAt: string;
  // hmacSecretHash is server-only — never sent to clients
}

export interface LevelCompletion {
  username: string;
  level: LevelId;
  completedAt: string;
  durationSec: number;
  evidence: string | null;
}

export interface Region {
  id: string; // e.g. 'us-central1'
  name: string; // e.g. 'Iowa, USA'
  lat: number;
  lng: number;
  cloudProvider: 'gcp';
}

// API request/response shapes

export interface CreateEventRequest {
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isPublic?: boolean;
  instructorToken: string;
}

export interface CreateEventResponse {
  code: string;
  joinUrl: string;
}

export interface RegisterBuilderRequest {
  eventCode: string;
  username: string;
  avatarPreset: AvatarPreset;
}

export interface RegisterBuilderResponse {
  username: string;
  publicProfileUrl: string;
  hmacSecret: string; // returned ONCE — never retrievable again
  instructions: string;
}

export interface BadgeRequest {
  level: LevelId;
  agentName?: string;
  region?: string;
  publicAgentUrl?: string;
  evidence?: string;
}

export interface BadgeResponse {
  ok: boolean;
  badgesEarned: LevelId[];
}

export interface BuilderProfile extends Builder {
  levels: Partial<Record<LevelId, { completedAt: string; durationSec: number }>>;
  totalSec: number;
  deployedAgentReachable?: boolean;
}

export interface FleetSnapshot {
  builders: Array<
    Pick<
      Builder,
      'username' | 'avatarPreset' | 'status' | 'region' | 'agentName' | 'publicAgentUrl'
    > & {
      levels: LevelId[];
    }
  >;
  total: number;
  deployed: number;
}
