import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { RobotIcon } from '@/components/avatar/RobotIcon';
import { AVATAR_LIST } from '@/lib/avatars';

const LEVELS = [
  {
    id: 0,
    title: 'Architecture Tour',
    desc: 'Get oriented. The 6 pillars of an autonomous agent.',
    dur: '60 min',
  },
  {
    id: 1,
    title: 'Build the Brain',
    desc: 'Agent loop, tools, personality, Telegram, sessions.',
    dur: '120 min',
  },
  {
    id: 2,
    title: 'Memory & Skills',
    desc: 'Context bootstrap, memory bank, compaction, runtime skills.',
    dur: '120 min',
  },
  {
    id: 3,
    title: 'The Agent Army',
    desc: 'Sub-agents, recovery pyramid, cron, dashboard.',
    dur: '120 min',
  },
  {
    id: 4,
    title: 'Ship to the Cloud',
    desc: 'Cloud Run, Firestore, Secret Manager, webhook.',
    dur: '150 min',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh">
      {/* === Hero === */}
      <section className="container-page py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-mono text-sm uppercase tracking-[0.18em] text-accent mb-6">
            Open source · Apache 2.0 · Google ADK + Gemini
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-ink-primary mb-6">
            Build your AI teammate. <br className="hidden sm:block" />
            <span className="text-accent">From a function call to global autonomy.</span>
          </h1>
          <p className="text-lg text-ink-secondary mb-10 leading-relaxed">
            A 5-level workshop teaching autonomous AI agents on Google ADK + Gemini in TypeScript.
            From `console.log` to a globally-reachable agent on Cloud Run, talking to you on
            Telegram, in <strong className="text-ink-primary">9.5 hours total</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/join/sandbox">
              <Button size="lg">Start Level 0 →</Button>
            </Link>
            <Link
              href="https://github.com/dahabit/adkclaw"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Button variant="secondary" size="lg">
                View on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* === Avatars preview === */}
      <section className="container-page pb-16">
        <div className="mx-auto max-w-3xl text-center mb-8">
          <p className="text-sm text-ink-tertiary uppercase tracking-[0.15em]">
            Pick your builder identity
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mx-auto max-w-4xl">
          {AVATAR_LIST.map((a) => (
            <div
              key={a.id}
              className="surface rounded-md p-3 transition-all duration-fast ease-out hover:border-accent hover:translate-y-[-2px]"
              title={a.name}
            >
              <RobotIcon preset={a.id} size={48} />
            </div>
          ))}
        </div>
      </section>

      {/* === The 5 levels === */}
      <section className="container-page py-16 sm:py-24">
        <h2 className="text-2xl font-display font-bold text-ink-primary mb-3 text-center">
          Five levels. Ship by the end.
        </h2>
        <p className="text-ink-secondary text-center mb-12 max-w-2xl mx-auto">
          Each level adds a pillar. By Level 4 your agent runs 24/7 on Google Cloud, reachable from
          any phone.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {LEVELS.map((lvl) => (
            <article
              key={lvl.id}
              className="surface rounded-md p-5 hover:border-accent transition-colors duration-fast ease-out"
            >
              <p className="text-mono text-xs text-accent mb-2">L{lvl.id}</p>
              <h3 className="font-display text-lg font-semibold mb-2">{lvl.title}</h3>
              <p className="text-ink-secondary text-sm leading-relaxed mb-4">{lvl.desc}</p>
              <p className="text-mono text-xs text-ink-tertiary">{lvl.dur}</p>
            </article>
          ))}
        </div>
      </section>

      {/* === Stack === */}
      <section className="container-page py-16">
        <div className="surface rounded-lg p-8 sm:p-12">
          <p className="text-mono text-xs uppercase tracking-[0.18em] text-ink-tertiary mb-4 text-center">
            Built on
          </p>
          <h2 className="text-xl font-display font-bold text-center mb-8">
            100% Google Cloud · 100% TypeScript · 100% open source
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-sm">
            {[
              ['Brain', 'Gemini 2.5 Pro / Flash'],
              ['SDK', '@google/genai (ADK)'],
              ['Hosting', 'Cloud Run'],
              ['Storage', 'Firestore'],
              ['Secrets', 'Secret Manager'],
              ['Cron', 'Cloud Scheduler'],
              ['Channels', 'Telegram (WhatsApp soon)'],
              ['License', 'Apache 2.0'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-ink-tertiary text-xs uppercase tracking-wider mb-1">{k}</p>
                <p className="text-ink-primary font-medium">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA === */}
      <section className="container-page py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">Ready to build?</h2>
        <p className="text-ink-secondary mb-8 max-w-xl mx-auto">
          Bring your own Gemini key + Telegram bot + Google Cloud project. We never see your
          secrets. Your agent runs on your infrastructure — and keeps running after the workshop
          ends.
        </p>
        <Link href="/join/sandbox">
          <Button size="lg">Join the sandbox →</Button>
        </Link>
      </section>

      {/* === Footer === */}
      <footer className="container-page border-t border-border-subtle py-16 mt-16">
        <div className="grid gap-10 sm:grid-cols-3 max-w-5xl mx-auto">
          {/* Brand */}
          <div className="sm:col-span-1">
            <p className="font-display text-xl font-bold text-ink-primary mb-2">AdkClaw</p>
            <p className="text-ink-tertiary text-sm leading-relaxed">
              Open-source workshop teaching autonomous AI agents on Google ADK.
            </p>
            <p className="text-ink-tertiary text-xs mt-4">
              Open source under{' '}
              <Link
                href="https://github.com/dahabit/adkclaw/blob/main/LICENSE"
                className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
              >
                Apache 2.0
              </Link>
              .
            </p>
          </div>

          {/* Created by */}
          <div>
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
              Created by
            </p>
            <p className="font-display text-base font-semibold text-ink-primary mb-1">
              Ahmed Abu Eldahab
            </p>
            <p className="text-ink-secondary text-sm mb-3">
              Google Developer Expert · Flutter & Dart
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li>
                <Link
                  href="https://github.com/dahabit"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out inline-flex items-center gap-2"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span aria-hidden>↗</span> github.com/dahabit
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.youtube.com/@h3boh3bo"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out inline-flex items-center gap-2"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span aria-hidden>↗</span> youtube.com/@h3boh3bo
                </Link>
              </li>
              <li>
                <Link
                  href="https://x.com/dahabdev"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out inline-flex items-center gap-2"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span aria-hidden>↗</span> @dahabdev on X
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.linkedin.com/in/dahabit/"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out inline-flex items-center gap-2"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span aria-hidden>↗</span> LinkedIn
                </Link>
              </li>
            </ul>
          </div>

          {/* Project */}
          <div>
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
              Project
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li>
                <Link
                  href="https://github.com/dahabit/adkclaw"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Repository
                </Link>
              </li>
              <li>
                <Link
                  href="/levels"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  Levels
                </Link>
              </li>
              <li>
                <Link
                  href="/quickstart"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  Quickstart
                </Link>
              </li>
              <li>
                <Link
                  href="/agent"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  Try the demo agent
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border-subtle text-center text-ink-tertiary text-xs">
          © {new Date().getFullYear()} Ahmed Abu Eldahab · adkclaw.dev · Built with Google ADK +
          Gemini
        </div>
      </footer>
    </main>
  );
}
