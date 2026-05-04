/**
 * 12 robot avatar presets. Each is a unique color palette applied to the
 * shared robot SVG silhouette (defined in components/avatar/RobotIcon.tsx).
 *
 * Per the project decisions: no AI-generated avatars in v1, just 12 presets.
 * Lavender is the only preset using purple, and it's a solid tint — not a gradient.
 */

import type { AvatarPreset } from './types';

export interface AvatarPalette {
  id: AvatarPreset;
  name: string;
  body: string; // primary chassis
  accent: string; // eye / antenna / panel highlight
  glow: string; // subtle outer ring (rgba)
}

export const AVATAR_PALETTES: Record<AvatarPreset, AvatarPalette> = {
  chrome: {
    id: 'chrome',
    name: 'Chrome',
    body: '#c4cdd9',
    accent: '#7dd3fc',
    glow: 'rgba(125, 211, 252, 0.35)',
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    body: '#a8763e',
    accent: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.35)',
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    body: '#475569',
    accent: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.35)',
  },
  mint: {
    id: 'mint',
    name: 'Mint',
    body: '#d4d8dc',
    accent: '#10b981',
    glow: 'rgba(16, 185, 129, 0.35)',
  },
  coral: {
    id: 'coral',
    name: 'Coral',
    body: '#d4d8dc',
    accent: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.35)',
  },
  sky: {
    id: 'sky',
    name: 'Sky',
    body: '#d4d8dc',
    accent: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.4)',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    body: '#d4d8dc',
    accent: '#facc15',
    glow: 'rgba(250, 204, 21, 0.4)',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    body: '#d4d8dc',
    accent: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.35)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    body: '#374151',
    accent: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.35)',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    body: '#d4d8dc',
    accent: '#f97316',
    glow: 'rgba(249, 115, 22, 0.35)',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic',
    body: '#e0e7ff',
    accent: '#7dd3fc',
    glow: 'rgba(125, 211, 252, 0.4)',
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic',
    body: '#1f2937',
    accent: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.5)',
  },
};

export const AVATAR_LIST = Object.values(AVATAR_PALETTES);
