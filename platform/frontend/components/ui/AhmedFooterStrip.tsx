'use client';

/**
 * Founder strip — small "Built by Ahmed" identity card.
 * Photo gracefully degrades to monogram if /ahmed.jpg is absent.
 */

import Link from 'next/link';

export function AhmedFooterStrip() {
  return (
    <div className="surface-raised rounded-xl px-6 py-5 sm:flex sm:items-center sm:gap-5">
      <div className="flex items-center gap-4 sm:flex-1">
        {/* Photo / monogram */}
        <div
          className="relative h-16 w-16 flex-none rounded-full overflow-hidden border-2"
          style={{
            borderColor: 'rgba(59, 130, 246, 0.55)',
            boxShadow: '0 0 18px -4px rgba(59,130,246,0.5)',
            background:
              'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.25), rgba(20,30,56,0.9) 70%)',
          }}
          aria-label="Ahmed Abu Eldahab — Google Developer Expert"
        >
          {/* If /ahmed.jpg exists in /public, it'll show; otherwise the alt-fallback shows */}
          <img
            src="/ahmed.jpg"
            alt="Ahmed Abu Eldahab"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold text-ink-primary -z-0"
          >
            AD
          </span>
          <span
            className="absolute -bottom-1 -right-1 inline-flex h-5 items-center rounded-full bg-accent px-1.5 text-[9px] font-bold uppercase tracking-wider text-bg-deep"
            aria-label="Google Developer Expert"
          >
            GDE
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary mb-1">
            Built by
          </p>
          <p className="font-display text-base font-semibold text-ink-primary">Ahmed Abu Eldahab</p>
          <p className="text-ink-secondary text-sm">Google Developer Expert · Flutter, Dart & AI</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 sm:mt-0">
        <SocialPill href="https://github.com/dahabit" label="GitHub" />
        <SocialPill href="https://www.youtube.com/@h3boh3bo" label="YouTube" />
        <SocialPill href="https://x.com/dahabdev" label="X" />
        <SocialPill href="https://www.linkedin.com/in/dahabit/" label="LinkedIn" />
      </div>
    </div>
  );
}

function SocialPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-ink-secondary transition-all duration-fast ease-out hover:border-accent hover:text-accent hover:-translate-y-0.5"
    >
      <span aria-hidden>↗</span>
      {label}
    </Link>
  );
}
