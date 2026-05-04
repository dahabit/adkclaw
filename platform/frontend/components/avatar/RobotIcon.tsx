/**
 * Single-source robot SVG. All 12 avatar presets render this with different
 * color palettes (see lib/avatars.ts). Inline SVG for no network requests.
 */

import { AVATAR_PALETTES } from '@/lib/avatars';
import type { AvatarPreset } from '@/lib/types';

interface Props {
  preset: AvatarPreset;
  size?: number;
  className?: string;
  withGlow?: boolean;
}

export function RobotIcon({ preset, size = 64, className = '', withGlow = false }: Props) {
  const p = AVATAR_PALETTES[preset];
  const id = `robot-${preset}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${p.name} robot avatar`}
      role="img"
      style={withGlow ? { filter: `drop-shadow(0 0 8px ${p.glow})` } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-body-grad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.body} stopOpacity="1" />
          <stop offset="100%" stopColor={p.body} stopOpacity="0.78" />
        </linearGradient>
      </defs>

      {/* Antenna */}
      <line x1="32" y1="6" x2="32" y2="14" stroke={p.body} strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="5" r="2.5" fill={p.accent} />

      {/* Head */}
      <rect
        x="14"
        y="14"
        width="36"
        height="26"
        rx="6"
        fill={`url(#${id}-body-grad)`}
        stroke={p.accent}
        strokeWidth="1.2"
      />

      {/* Eyes */}
      <circle cx="24" cy="26" r="3.5" fill={p.accent} />
      <circle cx="40" cy="26" r="3.5" fill={p.accent} />
      <circle cx="24" cy="26" r="1.5" fill="#0a0e1a" />
      <circle cx="40" cy="26" r="1.5" fill="#0a0e1a" />

      {/* Mouth panel */}
      <rect x="22" y="32" width="20" height="3" rx="1.5" fill={p.accent} opacity="0.65" />

      {/* Neck */}
      <rect x="28" y="40" width="8" height="3" fill={p.body} opacity="0.7" />

      {/* Body */}
      <rect
        x="10"
        y="43"
        width="44"
        height="16"
        rx="4"
        fill={`url(#${id}-body-grad)`}
        stroke={p.accent}
        strokeWidth="1"
        strokeOpacity="0.5"
      />

      {/* Chest panel */}
      <circle cx="32" cy="51" r="3.5" fill={p.accent} opacity="0.85" />
      <circle cx="32" cy="51" r="1.5" fill="#0a0e1a" />

      {/* Side panels (simulated arms) */}
      <rect x="6" y="46" width="4" height="8" rx="1.5" fill={p.body} />
      <rect x="54" y="46" width="4" height="8" rx="1.5" fill={p.body} />
    </svg>
  );
}
