/**
 * TechRail — interactive grid of the Google products each level builds on.
 * Inline SVG glyphs (no external network), per-brand color, hover lift,
 * level-tag pill on each tile.
 *
 * NOTE: This rail intentionally lists ONLY Google technologies (the "Powered by
 * Google" pitch). Open-source plumbing (TypeScript, telegraf, etc.) lives in
 * the footer's "Stack" column instead.
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
    name: 'Firebase',
    level: 'L4',
    blurb: 'Auth, Hosting, Cloud Messaging — when you outgrow Cloud Run alone.',
    color: '#FFCA28',
    path: 'M5 18 L8 4 L12 12 L17 8 L19 18 Z M8 4 L11 8 L12 12 Z',
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
];

export function TechRail() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
      {TECH.map((t) => (
        <article
          key={t.name}
          className="group relative surface rounded-xl p-5 transition-all duration-fast ease-out hover:-translate-y-1 hover:border-border-strong overflow-hidden"
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

          <div className="relative flex items-center gap-3 mb-3">
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg flex-none transition-transform duration-fast ease-out group-hover:rotate-3"
              style={{
                background: `${t.color}1a`,
                boxShadow: `inset 0 0 0 1px ${t.color}33, 0 6px 16px -4px ${t.color}55`,
              }}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill={t.color} aria-hidden>
                <path d={t.path} />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-ink-primary truncate">
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
          <p className="relative text-ink-tertiary text-sm leading-relaxed">{t.blurb}</p>
        </article>
      ))}
    </div>
  );
}
