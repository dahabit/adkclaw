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

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {visible.map((char) => {
          const isSelected = value === char.id;
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => onChange(char.id)}
              className={[
                'group relative rounded-lg p-3 transition-all duration-fast ease-out',
                'border-2 focus:outline-none flex flex-col items-center text-center',
                'hover:-translate-y-0.5',
                isSelected
                  ? 'bg-accent-muted border-accent shadow-glow scale-[1.03]'
                  : 'bg-bg-surface border-border-subtle hover:border-border-strong hover:bg-bg-raised',
              ].join(' ')}
              aria-pressed={isSelected}
              title={`${char.personality} · ${char.category}`}
              style={{
                background: isSelected
                  ? `radial-gradient(circle at 50% 0%, ${char.glow}, rgba(20, 30, 56, 0.55) 70%)`
                  : undefined,
              }}
            >
              <CharacterIcon preset={char.id} size={68} withGlow={isSelected} />
              <span
                className="mt-2 inline-flex items-center gap-1 text-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: isSelected ? char.accent : undefined }}
              >
                <span aria-hidden>{PERSONALITY_EMOJI[char.personality] || '🤖'}</span>
                <span className={isSelected ? '' : 'text-ink-tertiary'}>{char.personality}</span>
              </span>
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
