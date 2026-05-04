'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BuilderCard } from '@/components/ui/BuilderCard';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import type { FleetSnapshot, LevelId } from '@/lib/types';

const REFRESH_MS = 8000;

export default function FleetPage() {
  const params = useParams<{ event: string }>();
  const eventCode = params.event;

  const [eventName, setEventName] = useState<string | null>(null);
  const [fleet, setFleet] = useState<FleetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LevelId | 'deployed' | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval>;

    async function load() {
      try {
        const [event, snap] = await Promise.all([api.getEvent(eventCode), api.getFleet(eventCode)]);
        if (cancelled) return;
        setEventName(event.name);
        setFleet(snap);
        setLastRefresh(new Date());
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'event_not_found') {
          setError(`Event '${eventCode}' not found.`);
        } else {
          setError('Could not reach the workshop API.');
        }
        setLoading(false);
      }
    }

    load();
    timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventCode]);

  if (loading) {
    return (
      <main className="min-h-dvh container-page py-24">
        <p className="text-center text-ink-tertiary">Loading fleet…</p>
      </main>
    );
  }

  if (error || !fleet) {
    return (
      <main className="min-h-dvh container-page py-24 text-center">
        <h1 className="font-display text-2xl mb-4">Fleet unavailable</h1>
        <p className="text-ink-secondary mb-6">{error}</p>
        <Link href="/">
          <Button variant="secondary">Back to home</Button>
        </Link>
      </main>
    );
  }

  const filteredBuilders = fleet.builders.filter((b) => {
    if (filter === null) return true;
    if (filter === 'deployed') return b.status === 'deployed';
    return b.levels.includes(filter as LevelId);
  });

  return (
    <main className="min-h-dvh container-page py-12 sm:py-16">
      {/* Hero */}
      <section className="mb-10">
        <p className="text-mono text-xs uppercase tracking-[0.18em] text-accent mb-3">
          Cohort fleet · {eventCode}
        </p>
        <h1 className="text-3xl font-display font-bold mb-3">{eventName}</h1>
        <p className="text-ink-secondary">
          Real-time view of every builder in this cohort. Click any robot to see their profile.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <div className="surface rounded-md p-4">
          <p className="text-mono text-xs uppercase tracking-wider text-ink-tertiary mb-1">
            Builders
          </p>
          <p className="text-2xl font-display font-bold text-ink-primary">{fleet.total}</p>
        </div>
        <div className="surface rounded-md p-4">
          <p className="text-mono text-xs uppercase tracking-wider text-ink-tertiary mb-1">
            Deployed
          </p>
          <p className="text-2xl font-display font-bold text-status-deployed">{fleet.deployed}</p>
        </div>
        <div className="surface rounded-md p-4">
          <p className="text-mono text-xs uppercase tracking-wider text-ink-tertiary mb-1">L1+</p>
          <p className="text-2xl font-display font-bold text-status-progress">
            {fleet.builders.filter((b) => b.levels.length > 0).length}
          </p>
        </div>
        <div className="surface rounded-md p-4">
          <p className="text-mono text-xs uppercase tracking-wider text-ink-tertiary mb-1">
            L4 (cloud)
          </p>
          <p className="text-2xl font-display font-bold text-status-deployed">{fleet.deployed}</p>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-2 mb-6">
        <FilterButton active={filter === null} onClick={() => setFilter(null)}>
          All
        </FilterButton>
        {([1, 2, 3, 4] as LevelId[]).map((lvl) => (
          <FilterButton key={lvl} active={filter === lvl} onClick={() => setFilter(lvl)}>
            L{lvl}+
          </FilterButton>
        ))}
        <FilterButton active={filter === 'deployed'} onClick={() => setFilter('deployed')}>
          ☁️ Deployed
        </FilterButton>
        <span className="ml-auto text-mono text-[11px] text-ink-tertiary">
          {lastRefresh && `Updated ${lastRefresh.toLocaleTimeString()} · refreshes every 8s`}
        </span>
      </section>

      {/* Builders grid */}
      {filteredBuilders.length === 0 ? (
        <div className="surface rounded-lg p-12 text-center">
          <p className="text-ink-tertiary">No builders yet matching this filter.</p>
          <p className="text-ink-tertiary text-sm mt-2">
            Be the first —{' '}
            <Link href={`/join/${eventCode}`} className="text-accent hover:underline">
              join this cohort
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBuilders.map((b) => (
            <BuilderCard key={b.username} builder={b} />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-8 px-3 rounded-md text-sm transition-colors duration-fast ease-out',
        active
          ? 'bg-accent text-bg-deep font-semibold'
          : 'bg-bg-surface border border-border-subtle text-ink-secondary hover:border-accent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
