'use client';

import { CharacterIcon } from './CharacterIcon';
import { AVATAR_LIST } from '@/lib/avatars';
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
  return (
    <div>
      <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-4">
        Pick your character
      </p>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {AVATAR_LIST.map((char) => {
          const isSelected = value === char.id;
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => onChange(char.id)}
              className={[
                'group relative rounded-lg p-2 transition-all duration-fast ease-out',
                'border-2 focus:outline-none flex flex-col items-center text-center',
                'hover:-translate-y-0.5',
                isSelected
                  ? 'bg-accent-muted border-accent shadow-glow scale-[1.05]'
                  : 'bg-bg-surface/40 border-border-subtle hover:border-border-strong',
              ].join(' ')}
              aria-pressed={isSelected}
              title={char.personality}
              style={{
                background: isSelected
                  ? `radial-gradient(circle at 50% 0%, ${char.glow}, rgba(20, 30, 56, 0.55) 70%)`
                  : undefined,
              }}
            >
              <CharacterIcon preset={char.id} size={64} withGlow={isSelected} />
              <span
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-mono"
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
