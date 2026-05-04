'use client';

import { useState } from 'react';
import { RobotIcon } from './RobotIcon';
import { AVATAR_LIST } from '@/lib/avatars';
import type { AvatarPreset } from '@/lib/types';

interface Props {
  value: AvatarPreset | null;
  onChange: (preset: AvatarPreset) => void;
}

export function AvatarPicker({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<AvatarPreset | null>(null);

  return (
    <div>
      <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
        Pick your robot
      </p>
      <div className="grid grid-cols-6 gap-3">
        {AVATAR_LIST.map((a) => {
          const isSelected = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              onMouseEnter={() => setHovered(a.id)}
              onMouseLeave={() => setHovered(null)}
              className={[
                'rounded-md p-3 transition-all duration-fast ease-out',
                'border-2 focus:outline-none',
                isSelected
                  ? 'bg-accent-muted border-accent shadow-glow'
                  : 'bg-bg-surface border-border-subtle hover:border-border-strong',
              ].join(' ')}
              aria-pressed={isSelected}
              title={a.name}
            >
              <RobotIcon preset={a.id} size={42} withGlow={isSelected || hovered === a.id} />
              <p
                className={[
                  'mt-2 text-xs font-medium transition-colors duration-fast ease-out',
                  isSelected ? 'text-accent' : 'text-ink-tertiary',
                ].join(' ')}
              >
                {a.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
