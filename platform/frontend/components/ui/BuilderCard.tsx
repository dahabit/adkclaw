import Link from 'next/link';
import { RobotIcon } from '@/components/avatar/RobotIcon';
import type { Builder, LevelId } from '@/lib/types';

interface Props {
  builder: Pick<
    Builder,
    'username' | 'avatarPreset' | 'status' | 'region' | 'agentName' | 'publicAgentUrl'
  > & {
    levels: LevelId[];
  };
  variant?: 'compact' | 'full';
}

export function BuilderCard({ builder, variant = 'compact' }: Props) {
  const deployed = builder.status === 'deployed';
  const levelCount = builder.levels.length;

  return (
    <Link
      href={`/u/${builder.username}`}
      className="surface rounded-md p-4 hover:border-accent transition-all duration-fast ease-out flex items-center gap-3 group"
    >
      <div className="flex-shrink-0">
        <RobotIcon
          preset={builder.avatarPreset}
          size={variant === 'full' ? 56 : 44}
          withGlow={deployed}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-ink-primary font-semibold truncate group-hover:text-accent transition-colors duration-fast ease-out">
          {builder.username}
        </p>
        <p className="text-ink-tertiary text-xs truncate">
          {builder.agentName ? (
            <>&ldquo;{builder.agentName}&rdquo;</>
          ) : (
            <span className="italic">no name yet</span>
          )}
          {builder.region && <> · {builder.region}</>}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((lvl) => (
            <span
              key={lvl}
              className={[
                'h-1.5 w-4 rounded-full transition-all duration-fast ease-out',
                builder.levels.includes(lvl as LevelId)
                  ? deployed && lvl === 4
                    ? 'beacon-deployed'
                    : 'bg-status-progress'
                  : 'bg-border-subtle',
              ].join(' ')}
              title={`Level ${lvl}`}
            />
          ))}
        </div>
        <p className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
          {deployed ? '☁️ deployed' : levelCount > 0 ? `L${Math.max(...builder.levels)}` : 'idle'}
        </p>
      </div>
    </Link>
  );
}
