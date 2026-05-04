/**
 * 12 character avatars for the AdkClaw cohort fleet.
 *
 * Categories: 4 boys, 4 girls with hijab, 4 girls without hijab.
 * Each character has a personality tag (studious / cool / friendly / creative).
 *
 * Rendering: DiceBear's `notionists` style SVGs served from their CDN.
 * Seed-based — same seed always produces the same avatar (deterministic).
 * No AI generation, no per-build asset pipeline.
 */

import type { AvatarPreset } from './types';

export type AvatarCategory = 'boys' | 'hijab' | 'no-hijab';
export type AvatarPersonality = 'studious' | 'cool' | 'friendly' | 'creative';

export interface AvatarCharacter {
  id: AvatarPreset;
  name: string;
  category: AvatarCategory;
  personality: AvatarPersonality;
  /** Seed passed to DiceBear. Don't change once shipped — students keep their pick. */
  seed: string;
  /** DiceBear style. notionists has the broadest variety incl. hijab variants. */
  style: 'notionists' | 'notionists-neutral';
  /** Accent color for the soft glow / personality cue */
  accent: string;
  /** Used by status="deployed" — gold glow override */
  glow: string;
}

const ACCENT = {
  blue: { accent: '#3B82F6', glow: 'rgba(59, 130, 246, 0.4)' },
  gold: { accent: '#facc15', glow: 'rgba(250, 204, 21, 0.4)' },
  emerald: { accent: '#10b981', glow: 'rgba(16, 185, 129, 0.35)' },
  coral: { accent: '#fb7185', glow: 'rgba(251, 113, 133, 0.35)' },
  cyan: { accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.35)' },
  amber: { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)' },
  rose: { accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.35)' },
  indigo: { accent: '#6366f1', glow: 'rgba(99, 102, 241, 0.35)' },
  teal: { accent: '#14b8a6', glow: 'rgba(20, 184, 166, 0.35)' },
  violet: { accent: '#a78bfa', glow: 'rgba(167, 139, 250, 0.35)' },
  orange: { accent: '#f97316', glow: 'rgba(249, 115, 22, 0.35)' },
  sky: { accent: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.35)' },
};

export const AVATAR_CHARACTERS: Record<AvatarPreset, AvatarCharacter> = {
  // ─── Boys (4) ─────────────────────────────────────────────────────────
  chrome: {
    id: 'chrome',
    name: 'Ahmed',
    category: 'boys',
    personality: 'studious',
    seed: 'Ahmed-glasses-coder',
    style: 'notionists',
    ...ACCENT.blue,
  },
  bronze: {
    id: 'bronze',
    name: 'Omar',
    category: 'boys',
    personality: 'cool',
    seed: 'Omar-shades-confident',
    style: 'notionists',
    ...ACCENT.amber,
  },
  slate: {
    id: 'slate',
    name: 'Yusuf',
    category: 'boys',
    personality: 'friendly',
    seed: 'Yusuf-smile-warm',
    style: 'notionists',
    ...ACCENT.emerald,
  },
  cosmic: {
    id: 'cosmic',
    name: 'Adam',
    category: 'boys',
    personality: 'creative',
    seed: 'Adam-artist-builder',
    style: 'notionists',
    ...ACCENT.indigo,
  },

  // ─── Girls with hijab (4) ─────────────────────────────────────────────
  forest: {
    id: 'forest',
    name: 'Mariam',
    category: 'hijab',
    personality: 'studious',
    seed: 'Mariam-hijab-bookworm',
    style: 'notionists',
    ...ACCENT.teal,
  },
  arctic: {
    id: 'arctic',
    name: 'Aisha',
    category: 'hijab',
    personality: 'cool',
    seed: 'Aisha-hijab-stylish',
    style: 'notionists',
    ...ACCENT.sky,
  },
  mint: {
    id: 'mint',
    name: 'Fatima',
    category: 'hijab',
    personality: 'friendly',
    seed: 'Fatima-hijab-warm',
    style: 'notionists',
    ...ACCENT.rose,
  },
  lavender: {
    id: 'lavender',
    name: 'Layla',
    category: 'hijab',
    personality: 'creative',
    seed: 'Layla-hijab-artist',
    style: 'notionists',
    ...ACCENT.violet,
  },

  // ─── Girls without hijab (4) ──────────────────────────────────────────
  sky: {
    id: 'sky',
    name: 'Nour',
    category: 'no-hijab',
    personality: 'studious',
    seed: 'Nour-studious-tech',
    style: 'notionists',
    ...ACCENT.cyan,
  },
  coral: {
    id: 'coral',
    name: 'Hana',
    category: 'no-hijab',
    personality: 'cool',
    seed: 'Hana-cool-confident',
    style: 'notionists',
    ...ACCENT.coral,
  },
  gold: {
    id: 'gold',
    name: 'Maya',
    category: 'no-hijab',
    personality: 'friendly',
    seed: 'Maya-friendly-spark',
    style: 'notionists',
    ...ACCENT.gold,
  },
  sunset: {
    id: 'sunset',
    name: 'Reem',
    category: 'no-hijab',
    personality: 'creative',
    seed: 'Reem-creative-bold',
    style: 'notionists',
    ...ACCENT.orange,
  },
};

export const AVATAR_LIST: AvatarCharacter[] = Object.values(AVATAR_CHARACTERS);

export const AVATAR_CATEGORIES: { id: AvatarCategory; label: string }[] = [
  { id: 'boys', label: 'Boys' },
  { id: 'hijab', label: 'Girls with hijab' },
  { id: 'no-hijab', label: 'Girls' },
];

/**
 * Backwards-compat alias for code that imported AVATAR_PALETTES.
 * The "palette" concept is gone — each character now defines its own accent.
 */
export const AVATAR_PALETTES = AVATAR_CHARACTERS;

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';

/**
 * Builds the SVG URL for a character, rendered via DiceBear's CDN.
 */
export function avatarUrl(
  character: AvatarCharacter,
  opts: { size?: number; bg?: 'transparent' | string } = {},
): string {
  const params = new URLSearchParams();
  params.set('seed', character.seed);
  if (opts.size) params.set('size', String(opts.size));
  if (opts.bg && opts.bg !== 'transparent') {
    params.set('backgroundColor', opts.bg.replace('#', ''));
  }
  params.set('radius', '15');
  return `${DICEBEAR_BASE}/${character.style}/svg?${params.toString()}`;
}
