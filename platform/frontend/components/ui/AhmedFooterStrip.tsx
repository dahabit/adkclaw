'use client';

/**
 * AhmedFooterStrip — About card with prominent founder portrait, GDE chip, bio, socials.
 * Photo gracefully degrades to monogram if /ahmed.png is absent.
 */

import Link from 'next/link';

export function AhmedFooterStrip() {
  return (
    <div className="surface-raised rounded-2xl p-6 sm:p-8 grid gap-6 sm:gap-10 sm:grid-cols-[auto_1fr] items-center">
      {/* Photo */}
      <div
        className="relative h-40 w-40 sm:h-48 sm:w-48 flex-none rounded-2xl overflow-hidden border-2 mx-auto sm:mx-0"
        style={{
          borderColor: 'rgba(59, 130, 246, 0.55)',
          boxShadow: '0 0 36px -6px rgba(59,130,246,0.55)',
          background:
            'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.25), rgba(20,30,56,0.9) 70%)',
        }}
        aria-label="Ahmed Abu Eldahab — Google Developer Expert"
      >
        <img
          src="/ahmed.png"
          alt="Ahmed Abu Eldahab"
          className="h-full w-full object-cover"
          style={{ objectPosition: 'center top' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold text-ink-primary -z-0"
        >
          AD
        </span>
        <span
          className="absolute -bottom-2 -right-2 inline-flex h-7 items-center rounded-full bg-accent px-2 text-[10px] font-bold uppercase tracking-wider text-bg-deep shadow-glow"
          aria-label="Google Developer Expert"
        >
          GDE
        </span>
      </div>

      {/* Bio + socials */}
      <div className="text-center sm:text-left">
        <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-ink-tertiary mb-2">
          Built by
        </p>
        <p className="font-display text-2xl sm:text-3xl font-bold text-ink-primary leading-tight">
          Ahmed Abu Eldahab
        </p>
        <p className="text-accent text-sm font-semibold mt-1">
          Google Developer Expert · Flutter & Dart
        </p>
        <p className="text-ink-secondary text-sm mt-3 leading-relaxed">
          Speaker, course author, and shipping engineer. AdkClaw distills the agent patterns I use
          in production into a workshop students can finish in a weekend.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 justify-center sm:justify-start">
          <SocialPill href="https://github.com/dahabit" label="GitHub" />
          <SocialPill href="https://www.youtube.com/@h3boh3bo" label="YouTube" />
          <SocialPill href="https://x.com/dahabdev" label="X" />
          <SocialPill href="https://www.linkedin.com/in/dahabit/" label="LinkedIn" />
        </div>
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
