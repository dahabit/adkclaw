'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#levels', label: 'Levels' },
  { href: '#technology', label: 'Technology' },
  { href: '#about', label: 'About' },
];

/**
 * Sticky top navigation. Translucent until the user scrolls, then darkens
 * with a subtle hairline border. Anchor links scroll-smoothly to sections.
 */
export function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-40 transition-all duration-medium ease-out',
        scrolled
          ? 'bg-bg-deep/80 backdrop-blur-md border-b border-border-subtle'
          : 'bg-transparent',
      ].join(' ')}
    >
      <nav className="container-wide flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-ink-primary"
        >
          <span
            aria-hidden
            className="inline-block h-7 w-7 rounded-md"
            style={{
              background:
                'conic-gradient(from 220deg at 50% 50%, #3B82F6, #6366f1, #22d3ee, #3B82F6)',
              boxShadow: '0 0 12px rgba(59,130,246,0.45)',
            }}
          />
          AdkClaw
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="https://github.com/dahabit/adkclaw"
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
          >
            GitHub ↗
          </Link>
          <Link
            href="/join/sandbox"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-bg-deep hover:bg-accent-hover transition-colors duration-fast ease-out"
          >
            Join sandbox
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle text-ink-primary"
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden className="text-lg leading-none">
            {mobileOpen ? '×' : '☰'}
          </span>
        </button>
      </nav>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border-subtle bg-bg-deep/95 backdrop-blur-md">
          <ul className="container-wide py-4 flex flex-col gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-base text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2">
              <Link
                href="/join/sandbox"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg-deep"
              >
                Join sandbox
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
