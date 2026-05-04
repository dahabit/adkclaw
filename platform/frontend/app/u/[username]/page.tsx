import Link from 'next/link';
import { RobotIcon } from '@/components/avatar/RobotIcon';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { AVATAR_PALETTES } from '@/lib/avatars';
import type { LevelId } from '@/lib/types';

const LEVEL_META: Record<LevelId, { name: string; emoji: string }> = {
  0: { name: 'Tour', emoji: '🧭' },
  1: { name: 'Brain', emoji: '🧠' },
  2: { name: 'Memory', emoji: '💾' },
  3: { name: 'Army', emoji: '⚔️' },
  4: { name: 'Cloud', emoji: '☁️' },
};

interface Params {
  params: Promise<{ username: string }>;
}

export default async function BuilderProfilePage({ params }: Params) {
  const { username } = await params;
  let profile;
  try {
    profile = await api.getBuilder(username);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'builder_not_found') {
      return (
        <main className="min-h-dvh container-page py-24 text-center">
          <h1 className="font-display text-2xl mb-4">Builder not found</h1>
          <p className="text-ink-secondary mb-6">
            <code className="text-mono">{username}</code> isn&apos;t registered on AdkClaw.
          </p>
          <Link href="/">
            <Button variant="secondary">Back to home</Button>
          </Link>
        </main>
      );
    }
    throw err;
  }

  const palette = AVATAR_PALETTES[profile.avatarPreset];
  const completedLevels = (Object.keys(profile.levels) as Array<`${LevelId}`>)
    .map((k) => parseInt(k, 10) as LevelId)
    .sort((a, b) => a - b);
  const totalMin = Math.round(profile.totalSec / 60);
  const highestLevel: LevelId | null =
    completedLevels.length > 0 ? (completedLevels[completedLevels.length - 1] ?? null) : null;
  const nextLevel: LevelId | null =
    highestLevel === null ? 0 : highestLevel < 4 ? ((highestLevel + 1) as LevelId) : null;

  return (
    <main className="min-h-dvh container-page py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start mb-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <RobotIcon
                preset={profile.avatarPreset}
                size={140}
                withGlow={profile.status === 'deployed'}
              />
              {/* Highest-level badge floating on the bottom-right of the avatar */}
              {highestLevel !== null && highestLevel > 0 && (
                <span
                  className="absolute -bottom-1 -right-1 inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 font-display text-sm font-bold border-2"
                  style={{
                    background: palette.accent,
                    color: '#0a0e1a',
                    borderColor: '#0a0e1a',
                    boxShadow: `0 0 14px ${palette.glow}`,
                  }}
                  title={`Currently at Level ${highestLevel}`}
                >
                  L{highestLevel}
                </span>
              )}
            </div>
            {/* Mini-progress: 5 dots showing journey */}
            <div className="flex items-center gap-1.5">
              {([0, 1, 2, 3, 4] as LevelId[]).map((lvl) => {
                const completed = lvl in profile.levels;
                const isCurrent = lvl === highestLevel;
                return (
                  <span
                    key={lvl}
                    className="block h-2 w-6 rounded-full transition-all duration-fast ease-out"
                    style={{
                      background: completed
                        ? isCurrent
                          ? palette.accent
                          : 'rgba(16, 185, 129, 0.7)'
                        : 'rgba(154, 163, 184, 0.18)',
                      boxShadow: isCurrent ? `0 0 10px ${palette.glow}` : undefined,
                    }}
                    title={`Level ${lvl}${completed ? ' ✓' : ''}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-accent mb-2">
              Builder
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary mb-2">
              {profile.username}
            </h1>
            {profile.agentName ? (
              <p className="text-lg text-ink-secondary">
                Agent: <span className="text-ink-primary">&ldquo;{profile.agentName}&rdquo;</span>
              </p>
            ) : (
              <p className="text-ink-tertiary italic">Agent not named yet</p>
            )}

            <div className="flex items-center gap-4 mt-4 justify-center sm:justify-start text-sm text-ink-tertiary">
              {profile.region && <span className="text-mono">📍 {profile.region}</span>}
              <span className="text-mono">{completedLevels.length}/4 levels</span>
              {totalMin > 0 && <span className="text-mono">⏱ {totalMin}m</span>}
            </div>

            {profile.publicAgentUrl && (
              <div className="mt-6">
                <Link href={profile.publicAgentUrl} target="_blank" rel="noreferrer noopener">
                  <Button>Chat with {profile.agentName || profile.username} →</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Level journey */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary">
              Level journey
            </p>
            {nextLevel !== null && (
              <p className="text-mono text-xs text-accent">
                ↓ next up: <span className="font-semibold">L{nextLevel}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([0, 1, 2, 3, 4] as LevelId[]).map((lvl) => {
              const completed = lvl in profile.levels;
              const meta = LEVEL_META[lvl];
              const completion = profile.levels[lvl];
              const isNext = lvl === nextLevel;
              return (
                <div
                  key={lvl}
                  className={[
                    'relative rounded-lg p-4 text-center transition-all duration-fast ease-out border-2',
                    completed
                      ? 'surface border-status-progress'
                      : isNext
                        ? 'surface border-accent shadow-glow'
                        : 'surface border-border-subtle opacity-50',
                  ].join(' ')}
                >
                  {isNext && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 inline-block rounded-full bg-accent px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider text-bg-deep">
                      Next
                    </span>
                  )}
                  <p className="text-2xl mb-1">{meta.emoji}</p>
                  <p className="text-mono text-xs text-accent">L{lvl}</p>
                  <p className="font-display text-sm font-semibold text-ink-primary">{meta.name}</p>
                  {completion ? (
                    <p className="text-mono text-[10px] text-status-progress mt-1">
                      ✓ {Math.round(completion.durationSec / 60)}m
                    </p>
                  ) : (
                    <p className="text-mono text-[10px] text-ink-tertiary mt-1">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Status block */}
        <section className="surface rounded-lg p-6">
          <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
            Status
          </p>
          {profile.status === 'deployed' ? (
            <p className="text-status-deployed font-medium">
              ☁️ Deployed to Google Cloud Run
              {profile.region && <> in {profile.region}</>}
            </p>
          ) : profile.status === 'building' ? (
            <p className="text-status-progress font-medium">⚡ In progress</p>
          ) : (
            <p className="text-status-idle font-medium">🤖 Just registered</p>
          )}
          <p className="text-ink-tertiary text-xs mt-2">
            Joined {new Date(profile.registeredAt).toLocaleDateString()}
          </p>
        </section>

        <div className="mt-8 text-center">
          <Link href="/" className="text-accent hover:underline text-sm">
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
