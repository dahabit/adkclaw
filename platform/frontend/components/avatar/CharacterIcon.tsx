'use client';

/**
 * CharacterIcon — renders a painterly portrait from /public/avatars/<id>.png
 * inside a colored ring (cmux-style). The ring color is the character's accent.
 *
 * If the PNG is missing (Imagen hasn't generated it yet), the dark gradient
 * background shows through so the page still looks alive.
 */

import Image from 'next/image';
import { useState } from 'react';
import { AVATAR_CHARACTERS } from '@/lib/avatars';
import type { AvatarPreset } from '@/lib/types';

interface Props {
  preset: AvatarPreset;
  size?: number;
  className?: string;
  /** When true, an extra outer halo glow is rendered (selected / status=deployed). */
  withGlow?: boolean;
  /** Pixel width of the ring border. Default 3. */
  ringWidth?: number;
}

export function CharacterIcon({
  preset,
  size = 64,
  className = '',
  withGlow = false,
  ringWidth = 3,
}: Props) {
  const character = AVATAR_CHARACTERS[preset];
  const [hidden, setHidden] = useState(false);
  if (!character) return null;

  const ring = character.accent;

  return (
    <div
      className={['relative inline-flex items-center justify-center', className].join(' ')}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        padding: ringWidth,
        background: `conic-gradient(from 220deg, ${ring}, ${ring}cc, ${ring})`,
        boxShadow: withGlow
          ? `0 0 22px ${character.glow}, inset 0 0 0 1px rgba(255,255,255,0.08)`
          : `0 0 10px ${character.glow}55, inset 0 0 0 1px rgba(255,255,255,0.05)`,
        transition: 'box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      aria-label={`${character.personality} ${character.category} avatar`}
      role="img"
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(59,130,246,0.25), rgba(20,30,56,0.92) 80%)',
        }}
      >
        {!hidden && (
          <Image
            src={`/avatars/${character.id}.png`}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            sizes={`${size}px`}
            className="h-full w-full object-cover"
            onError={() => setHidden(true)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Backwards-compat re-export. Old code imported `RobotIcon` — alias to
 * CharacterIcon so we don't have to update every call site immediately.
 */
export const RobotIcon = CharacterIcon;
