/**
 * TechRail — horizontal rail of the tech each level builds on.
 * Inline SVG glyphs (no external network), brand-colored hover states.
 */

interface Tech {
  name: string;
  level: string;
  color: string;
  /** simple-icons-style monochrome paths in a 24×24 viewBox */
  path: string;
}

const TECH: Tech[] = [
  {
    name: 'Gemini',
    level: 'L1–L4',
    color: '#4285F4',
    path: 'M12 2 L13.5 9 L21 12 L13.5 15 L12 22 L10.5 15 L3 12 L10.5 9 Z',
  },
  {
    name: 'ADK',
    level: 'L1–L4',
    color: '#34A853',
    path: 'M3 5h18v3H3zm0 5h18v3H3zm0 5h18v3H3z',
  },
  {
    name: 'TypeScript',
    level: 'L0–L4',
    color: '#3178C6',
    path: 'M3 3h18v18H3V3zm10 13.5h-2v-7h-2v-1.5h6v1.5h-2v7zm6.5-3.2c-.4-.4-1-.7-1.7-.7-.6 0-1 .2-1 .7s.4.6 1.3.9c1.5.4 2.4 1 2.4 2.3 0 1.4-1.1 2.3-2.7 2.3-1.2 0-2-.4-2.6-1l1.1-1.1c.4.4 1 .7 1.6.7.6 0 1.1-.2 1.1-.7s-.4-.7-1.4-1c-1.4-.4-2.3-.9-2.3-2.3 0-1.2 1-2.1 2.5-2.1 1 0 1.7.3 2.2.8l-1.1 1.2z',
  },
  {
    name: 'Cloud Run',
    level: 'L4',
    color: '#4285F4',
    path: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 14.5L7 12.5l1.4-1.4 2.6 2.6 5.6-5.6L18 9.5l-7 7z',
  },
  {
    name: 'Vertex AI',
    level: 'L3–L4',
    color: '#1A73E8',
    path: 'M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z M12 5 L7 8 L7 16 L12 19 L17 16 L17 8 Z',
  },
  {
    name: 'Firestore',
    level: 'L4',
    color: '#FF6F00',
    path: 'M5 5 L19 5 L17 19 L7 19 Z M9 9 L15 9 L14 15 L10 15 Z',
  },
  {
    name: 'Cloud Build',
    level: 'L4',
    color: '#4285F4',
    path: 'M3 7 L12 2 L21 7 L21 17 L12 22 L3 17 Z M12 6 L7 9 L7 15 L12 18 L17 15 L17 9 Z',
  },
  {
    name: 'Telegram',
    level: 'L1',
    color: '#0088CC',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.62-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z',
  },
];

export function TechRail() {
  return (
    <div className="surface rounded-xl px-6 py-5">
      <p className="text-mono text-xs uppercase tracking-[0.18em] text-ink-tertiary mb-4 text-center">
        Built on Google · TypeScript · open source
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {TECH.map((t) => (
          <li
            key={t.name}
            className="group flex items-center gap-2 transition-transform duration-fast ease-out hover:-translate-y-0.5"
            title={`${t.name} · ${t.level}`}
          >
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-fast ease-out"
              style={{
                background: `${t.color}1a`,
                boxShadow: `inset 0 0 0 1px ${t.color}33`,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill={t.color}
                aria-hidden
                focusable="false"
              >
                <path d={t.path} />
              </svg>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-ink-primary">{t.name}</span>
              <span className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                {t.level}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
