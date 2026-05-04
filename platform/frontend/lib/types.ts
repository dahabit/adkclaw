/**
 * Frontend-side mirror of the API's data model.
 * Mirror of platform/api/src/types/shared.ts.
 */

export type LevelId = 0 | 1 | 2 | 3 | 4;

export type AvatarPreset =
  | 'chrome'
  | 'bronze'
  | 'slate'
  | 'mint'
  | 'coral'
  | 'sky'
  | 'gold'
  | 'lavender'
  | 'forest'
  | 'sunset'
  | 'arctic'
  | 'cosmic';

export type BuilderStatus = 'idle' | 'building' | 'deployed';

export type EventStatus = 'open' | 'closed';

export interface Event {
  code: string;
  name: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isPublic: boolean;
  createdAt: string;
}

export interface Builder {
  username: string;
  eventCode: string;
  avatarPreset: AvatarPreset;
  agentName: string | null;
  region: string | null;
  publicAgentUrl: string | null;
  publicTelegramHandle: string | null;
  status: BuilderStatus;
  registeredAt: string;
}

export interface BuilderProfile extends Builder {
  levels: Partial<Record<LevelId, { completedAt: string; durationSec: number }>>;
  totalSec: number;
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

export interface Region {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cloudProvider: 'gcp';
}

export interface RegisterBuilderRequest {
  eventCode: string;
  username: string;
  avatarPreset: AvatarPreset;
}

export interface RegisterBuilderResponse {
  username: string;
  publicProfileUrl: string;
  hmacSecret: string;
  instructions: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  'chrome',
  'bronze',
  'slate',
  'mint',
  'coral',
  'sky',
  'gold',
  'lavender',
  'forest',
  'sunset',
  'arctic',
  'cosmic',
];
