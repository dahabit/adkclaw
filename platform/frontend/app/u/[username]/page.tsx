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

  return (
    <main className="min-h-dvh container-page py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start mb-12">
          <div
            className="rounded-lg p-4 surface"
            style={{
              boxShadow: profile.status === 'deployed' ? `0 0 32px ${palette.glow}` : undefined,
            }}
          >
            <RobotIcon
              preset={profile.avatarPreset}
              size={120}
              withGlow={profile.status === 'deployed'}
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-accent mb-2">
              Builder · {palette.name}
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

        {/* Level badges */}
        <section className="mb-12">
          <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-4">
            Levels completed
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([0, 1, 2, 3, 4] as LevelId[]).map((lvl) => {
              const completed = lvl in profile.levels;
              const meta = LEVEL_META[lvl];
              const completion = profile.levels[lvl];
              return (
                <div
                  key={lvl}
                  className={[
                    'rounded-md p-4 text-center transition-all duration-fast ease-out',
                    completed ? 'surface border-status-progress' : 'surface opacity-50',
                  ].join(' ')}
                >
                  <p className="text-2xl mb-1">{meta.emoji}</p>
                  <p className="text-mono text-xs text-accent">L{lvl}</p>
                  <p className="font-display text-sm font-semibold text-ink-primary">{meta.name}</p>
                  {completion ? (
                    <p className="text-mono text-[10px] text-ink-tertiary mt-1">
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
