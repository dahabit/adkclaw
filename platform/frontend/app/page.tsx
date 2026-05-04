import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CharacterIcon } from '@/components/avatar/CharacterIcon';
import { AVATAR_LIST } from '@/lib/avatars';
import { FadeIn } from '@/components/ui/FadeIn';
import { TechRail } from '@/components/ui/TechRail';
import { AhmedFooterStrip } from '@/components/ui/AhmedFooterStrip';

const LEVELS = [
  {
    id: 0,
    title: 'Architecture Tour',
    desc: 'Get oriented. The 6 pillars of an autonomous agent.',
    dur: '60 min',
    tag: 'Orientation',
  },
  {
    id: 1,
    title: 'Build the Brain',
    desc: 'Agent loop, tools, personality, Telegram, sessions.',
    dur: '120 min',
    tag: 'Foundations',
  },
  {
    id: 2,
    title: 'Memory & Skills',
    desc: 'Context bootstrap, memory bank, compaction, runtime skills.',
    dur: '120 min',
    tag: 'Cognition',
  },
  {
    id: 3,
    title: 'The Agent Army',
    desc: 'Sub-agents, recovery pyramid, cron, dashboard.',
    dur: '120 min',
    tag: 'Autonomy',
  },
  {
    id: 4,
    title: 'Ship to the Cloud',
    desc: 'Cloud Run, Firestore, Secret Manager, webhook.',
    dur: '150 min',
    tag: 'Production',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh">
      {/* === Hero === */}
      <section className="container-page py-24 sm:py-32 relative">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="text-mono text-sm uppercase tracking-[0.18em] text-accent mb-6">
              Open source · Apache 2.0 · Google ADK + Gemini
            </p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-ink-primary mb-6">
              Build your AI teammate. <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-accent via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                From a function call to global autonomy.
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="text-lg text-ink-secondary mb-10 leading-relaxed">
              A 5-level workshop teaching autonomous AI agents on Google ADK + Gemini in TypeScript.
              From <code className="text-mono text-accent">console.log</code> to a
              globally-reachable agent on Cloud Run, talking to you on Telegram, in{' '}
              <strong className="text-ink-primary">9.5 hours total</strong>.
            </p>
          </FadeIn>
          <FadeIn delay={240}>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/join/sandbox" className="btn-hero text-base inline-flex items-center">
                Start Level 0 →
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
          </FadeIn>
        </div>
      </section>

      {/* === Avatar gallery === */}
      <FadeIn>
        <section className="container-page pb-20">
          <div className="mx-auto max-w-3xl text-center mb-8">
            <p className="text-mono text-xs uppercase tracking-[0.2em] text-accent mb-2">
              Pick your face
            </p>
            <h2 className="text-xl font-display font-semibold text-ink-primary">
              Twelve characters. One you.
            </h2>
            <p className="text-ink-secondary text-sm mt-2">
              Painterly portraits — boys, girls with hijab, girls — generated with Imagen 3 on
              Vertex AI.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mx-auto max-w-5xl">
            {AVATAR_LIST.map((a, i) => (
              <div
                key={a.id}
                className="surface rounded-lg p-2 transition-all duration-fast ease-out hover:-translate-y-1"
                style={{
                  borderColor: 'rgba(154,163,184,0.12)',
                  boxShadow: `inset 0 0 0 1px ${a.glow}`,
                  animation: `pulse-glow 3s ease-in-out ${i * 200}ms infinite`,
                }}
                title={`${a.personality} · ${a.category}`}
              >
                <CharacterIcon preset={a.id} size={64} />
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      {/* === The 5 levels === */}
      <section className="container-page py-16 sm:py-24">
        <FadeIn>
          <h2 className="text-2xl font-display font-bold text-ink-primary mb-3 text-center">
            Five levels. Ship by the end.
          </h2>
          <p className="text-ink-secondary text-center mb-12 max-w-2xl mx-auto">
            Each level adds a pillar. By Level 4 your agent runs 24/7 on Google Cloud, reachable
            from any phone.
          </p>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {LEVELS.map((lvl, i) => (
            <FadeIn key={lvl.id} delay={i * 80}>
              <article
                className={[
                  'surface rounded-lg p-5 level-card',
                  `level-glow-${lvl.id}`,
                  'h-full',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-mono text-xs font-semibold level-tag">L{lvl.id}</p>
                  <p className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                    {lvl.tag}
                  </p>
                </div>
                <h3 className="font-display text-lg font-semibold mb-2 text-ink-primary">
                  {lvl.title}
                </h3>
                <p className="text-ink-secondary text-sm leading-relaxed mb-4">{lvl.desc}</p>
                <p className="text-mono text-xs text-ink-tertiary">{lvl.dur}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* === Tech rail === */}
      <FadeIn>
        <section className="container-page py-12">
          <TechRail />
        </section>
      </FadeIn>

      {/* === CTA === */}
      <FadeIn>
        <section className="container-page py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4 text-ink-primary">
            Ready to build?
          </h2>
          <p className="text-ink-secondary mb-8 max-w-xl mx-auto">
            Bring your own Gemini key + Telegram bot + Google Cloud project. We never see your
            secrets. Your agent runs on your infrastructure — and keeps running after the workshop
            ends.
          </p>
          <Link href="/join/sandbox" className="btn-hero text-base inline-flex items-center">
            Join the sandbox →
          </Link>
        </section>
      </FadeIn>

      {/* === Footer === */}
      <footer className="container-page border-t border-border-subtle py-16 mt-16">
        <FadeIn>
          <div className="mb-12">
            <AhmedFooterStrip />
          </div>
        </FadeIn>

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
                  href="/quickstart"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  Quickstart
                </Link>
              </li>
              <li>
                <Link
                  href="/join/sandbox"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  Join the sandbox
                </Link>
              </li>
            </ul>
          </div>

          {/* Stack */}
          <div>
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
              Stack
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-secondary">
              <li>Gemini 2.5 Pro / Flash</li>
              <li>Google ADK · TypeScript</li>
              <li>Cloud Run · Firestore</li>
              <li>Secret Manager · Cloud Build</li>
              <li>Telegram (WhatsApp soon)</li>
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
