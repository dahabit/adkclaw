/**
 * TechRail — interactive grid of the tech each level builds on.
 * Inline SVG glyphs (no external network), per-brand color, hover lift,
 * level-tag pill on each tile.
 */

interface Tech {
  name: string;
  level: string;
  blurb: string;
  color: string;
  /** monochrome path in a 24x24 viewBox */
  path: string;
}

const TECH: Tech[] = [
  {
    name: 'Gemini 2.5',
    level: 'L1–L4',
    blurb: 'The brain — Pro for reasoning, Flash for speed.',
    color: '#4285F4',
    path: 'M12 2 L13.6 9.2 L21 12 L13.6 14.8 L12 22 L10.4 14.8 L3 12 L10.4 9.2 Z',
  },
  {
    name: 'Google ADK',
    level: 'L1–L4',
    blurb: 'Agent Development Kit — function calling, callbacks, tools.',
    color: '#34A853',
    path: 'M3 6h18v3H3zm0 4.5h18v3H3zm0 4.5h18v3H3z',
  },
  {
    name: 'Vertex AI',
    level: 'L3–L4',
    blurb: 'Embeddings, vector search, grounding, Imagen.',
    color: '#1A73E8',
    path: 'M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z M12 5 L7 8 L7 16 L12 19 L17 16 L17 8 Z',
  },
  {
    name: 'TypeScript',
    level: 'L0–L4',
    blurb: 'Strict mode. Type-safe agent loop, tool registry, healing engine.',
    color: '#3178C6',
    path: 'M3 3h18v18H3V3zm10 13.5h-2v-7h-2v-1.5h6v1.5h-2v7zm6.5-3.2c-.4-.4-1-.7-1.7-.7-.6 0-1 .2-1 .7s.4.6 1.3.9c1.5.4 2.4 1 2.4 2.3 0 1.4-1.1 2.3-2.7 2.3-1.2 0-2-.4-2.6-1l1.1-1.1c.4.4 1 .7 1.6.7.6 0 1.1-.2 1.1-.7s-.4-.7-1.4-1c-1.4-.4-2.3-.9-2.3-2.3 0-1.2 1-2.1 2.5-2.1 1 0 1.7.3 2.2.8l-1.1 1.2z',
  },
  {
    name: 'Cloud Run',
    level: 'L4',
    blurb: 'Serverless container. Scale-to-zero. HTTPS in seconds.',
    color: '#4285F4',
    path: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 14.5L7 12.5l1.4-1.4 2.6 2.6 5.6-5.6L18 9.5l-7 7z',
  },
  {
    name: 'Firestore',
    level: 'L4',
    blurb: 'Sessions, messages, cron history. Multi-region native.',
    color: '#FF6F00',
    path: 'M5 5 L19 5 L17 19 L7 19 Z M9 9 L15 9 L14 15 L10 15 Z',
  },
  {
    name: 'Cloud Build',
    level: 'L4',
    blurb: 'CI/CD. Trigger on push, deploy to Cloud Run.',
    color: '#4285F4',
    path: 'M3 7 L12 2 L21 7 L21 17 L12 22 L3 17 Z M12 6 L7 9 L7 15 L12 18 L17 15 L17 9 Z',
  },
  {
    name: 'Secret Manager',
    level: 'L4',
    blurb: 'API keys, HMAC secrets — never in env files in prod.',
    color: '#1A73E8',
    path: 'M12 2 L4 5 L4 11 C4 16 7.5 20.5 12 22 C16.5 20.5 20 16 20 11 L20 5 Z M12 7 a3 3 0 0 1 0 6 a3 3 0 0 1 0 -6 Z',
  },
  {
    name: 'Cloud Scheduler',
    level: 'L3–L4',
    blurb: 'Heartbeat cron. Wakes the agent on a schedule.',
    color: '#34A853',
    path: 'M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20 z M12 6 v6 l4 2 l-1 1.6 l-5 -2.6 V6 Z',
  },
  {
    name: 'Telegram',
    level: 'L1+',
    blurb: 'Primary channel. telegraf wrapper, allowlist, webhook on L4.',
    color: '#0088CC',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.62-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z',
  },
  {
    name: 'WhatsApp',
    level: 'L1+',
    blurb: 'Coming soon — second channel via WhatsApp Cloud API.',
    color: '#25D366',
    path: 'M12 2a10 10 0 0 0 -8.6 14.9 L2 22 l5.3 -1.4 A10 10 0 1 0 12 2 Z M16.5 14.6 c-.3.7-1.4 1.4-2 1.5 -.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.7 -3-1.3-5-4.3-5.1-4.5-.2-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1-2.5.3-.3.7-.4 .9-.4l.7 0c.2 0 .5-.1.8.6.3.7.9 2.2 1 2.4.1.1.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.1.1-.3.2-.1.5.2.3.8 1.4 1.8 2.3 1.3 1.2 2.4 1.5 2.7 1.7.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.7-.1.3.1 1.7.8 2 1 .3.1.5.2.6.3 .1.2.1.8-.2 1.5z',
  },
  {
    name: 'Apache 2.0',
    level: 'L0+',
    blurb: 'Permissive open-source license. Use it however you want.',
    color: '#94A3B8',
    path: 'M12 2 L4 5 L4 11 C4 16 7.5 20.5 12 22 C16.5 20.5 20 16 20 11 L20 5 Z',
  },
];

export function TechRail() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {TECH.map((t) => (
        <article
          key={t.name}
          className="group relative surface rounded-xl p-4 transition-all duration-fast ease-out hover:-translate-y-1 hover:border-border-strong overflow-hidden"
          style={{ borderColor: 'rgba(154,163,184,0.12)' }}
        >
          {/* Brand-tinted hover wash */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-medium ease-out"
            style={{
              background: `radial-gradient(circle at 0% 0%, ${t.color}22, transparent 70%)`,
            }}
          />

          <div className="relative flex items-center gap-3 mb-2">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg flex-none transition-transform duration-fast ease-out group-hover:rotate-3"
              style={{
                background: `${t.color}1a`,
                boxShadow: `inset 0 0 0 1px ${t.color}33, 0 4px 12px -4px ${t.color}55`,
              }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill={t.color} aria-hidden>
                <path d={t.path} />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-ink-primary truncate">
                {t.name}
              </p>
              <p
                className="text-mono text-[10px] uppercase tracking-wider"
                style={{ color: t.color }}
              >
                {t.level}
              </p>
            </div>
          </div>
          <p className="relative text-ink-tertiary text-xs leading-relaxed">{t.blurb}</p>
        </article>
      ))}
    </div>
  );
}
