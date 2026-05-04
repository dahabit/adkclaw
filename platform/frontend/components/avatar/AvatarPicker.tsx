'use client';

import { useState } from 'react';
import { CharacterIcon } from './CharacterIcon';
import { AVATAR_LIST, AVATAR_CATEGORIES, type AvatarCategory } from '@/lib/avatars';
import type { AvatarPreset } from '@/lib/types';

interface Props {
  value: AvatarPreset | null;
  onChange: (preset: AvatarPreset) => void;
}

const PERSONALITY_EMOJI: Record<string, string> = {
  studious: '📚',
  cool: '😎',
  friendly: '☀️',
  creative: '🎨',
};

export function AvatarPicker({ value, onChange }: Props) {
  const [filter, setFilter] = useState<AvatarCategory | 'all'>('all');

  const visible = filter === 'all' ? AVATAR_LIST : AVATAR_LIST.filter((c) => c.category === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mr-2">
          Pick your character
        </p>
        <CategoryButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
        {AVATAR_CATEGORIES.map((cat) => (
          <CategoryButton
            key={cat.id}
            active={filter === cat.id}
            onClick={() => setFilter(cat.id)}
            label={cat.label}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visible.map((char) => {
          const isSelected = value === char.id;
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => onChange(char.id)}
              className={[
                'rounded-md p-3 transition-all duration-fast ease-out',
                'border-2 focus:outline-none flex flex-col items-center text-center',
                isSelected
                  ? 'bg-accent-muted border-accent shadow-glow'
                  : 'bg-bg-surface border-border-subtle hover:border-border-strong hover:bg-bg-raised',
              ].join(' ')}
              aria-pressed={isSelected}
              title={`${char.name} · ${char.personality}`}
            >
              <CharacterIcon preset={char.id} size={72} withGlow={isSelected} />
              <div className="mt-2 flex items-center gap-1">
                <span className="text-base" aria-hidden>
                  {PERSONALITY_EMOJI[char.personality] || '🤖'}
                </span>
                <p
                  className={[
                    'text-sm font-semibold transition-colors duration-fast ease-out',
                    isSelected ? 'text-accent' : 'text-ink-primary',
                  ].join(' ')}
                >
                  {char.name}
                </p>
              </div>
              <p className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                {char.personality}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-8 px-3 rounded-md text-xs transition-colors duration-fast ease-out',
        active
          ? 'bg-accent text-bg-deep font-semibold'
          : 'bg-bg-surface border border-border-subtle text-ink-secondary hover:border-accent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
