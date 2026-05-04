/**
 * CharacterIcon — renders a single avatar from DiceBear via <img>.
 * Replaces the old RobotIcon. Same props for backwards compatibility.
 */

import { AVATAR_CHARACTERS, avatarUrl } from '@/lib/avatars';
import type { AvatarPreset } from '@/lib/types';

interface Props {
  preset: AvatarPreset;
  size?: number;
  className?: string;
  withGlow?: boolean;
}

export function CharacterIcon({ preset, size = 64, className = '', withGlow = false }: Props) {
  const character = AVATAR_CHARACTERS[preset];
  if (!character) return null;

  return (
    <div
      className={['inline-flex items-center justify-center', className].join(' ')}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: 'rgba(20, 30, 56, 0.55)',
        boxShadow: withGlow ? `0 0 18px ${character.glow}` : undefined,
        transition: 'box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      aria-label={`${character.name} avatar`}
      role="img"
    >
      <img
        src={avatarUrl(character, { size: Math.round(size * 1.6) })}
        alt={character.name}
        width={size}
        height={size}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: 12,
        }}
      />
    </div>
  );
}

/**
 * Backwards-compat re-export. Old code imported `RobotIcon` — alias to
 * CharacterIcon so we don't have to update every call site immediately.
 */
export const RobotIcon = CharacterIcon;
