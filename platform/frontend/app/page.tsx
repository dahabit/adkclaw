import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CharacterIcon } from '@/components/avatar/CharacterIcon';
import { AVATAR_LIST } from '@/lib/avatars';
import { FadeIn } from '@/components/ui/FadeIn';
import { TechRail } from '@/components/ui/TechRail';
import { AhmedFooterStrip } from '@/components/ui/AhmedFooterStrip';
import { TopNav } from '@/components/ui/TopNav';

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
      <TopNav />

      {/* === Hero === */}
      <section
        id="home"
        className="container-wide pt-32 pb-20 sm:pt-36 sm:pb-28 relative scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl text-center">
          <FadeIn>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-ink-primary mb-6 leading-[1.05]">
              Build your AI teammate. <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-accent via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                From a function call to global autonomy.
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={120}>
            <p className="text-lg sm:text-xl text-ink-secondary mb-10 leading-relaxed max-w-3xl mx-auto">
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
        <section className="container-wide pb-20">
          <div className="mx-auto max-w-3xl text-center mb-8">
            <p className="text-mono text-xs uppercase tracking-[0.2em] text-accent mb-2">
              Pick your face
            </p>
            <p className="text-ink-secondary text-sm">
              Painterly portraits — each builder gets one. You add your own name.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mx-auto max-w-6xl">
            {AVATAR_LIST.map((a, i) => (
              <div
                key={a.id}
                className="rounded-full transition-all duration-fast ease-out hover:-translate-y-1 hover:scale-105"
                style={{ animation: `pulse-glow 4s ease-in-out ${i * 200}ms infinite` }}
                title={a.personality}
              >
                <CharacterIcon preset={a.id} size={64} />
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      {/* === The 5 levels === */}
      <section id="levels" className="container-wide py-16 sm:py-24 scroll-mt-20">
        <FadeIn>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary mb-3 text-center">
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
      <section id="technology" className="container-wide py-16 scroll-mt-20">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary mb-3">
              Powered by Google
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              Production-grade Google Cloud + open-source plumbing. Every layer is something the
              workshop teaches you to operate.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={120}>
          <TechRail />
        </FadeIn>
      </section>

      {/* === About / Builder === */}
      <section id="about" className="container-wide py-16 scroll-mt-20">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary mb-3">
              Who built this
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              AdkClaw is an open-source workshop by a Google Developer Expert — distilled from
              shipping production agent systems.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={120}>
          <div className="max-w-4xl mx-auto">
            <AhmedFooterStrip />
          </div>
        </FadeIn>
      </section>

      {/* === CTA === */}
      <FadeIn>
        <section className="container-wide py-24 text-center">
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
      <footer className="container-wide border-t border-border-subtle py-12 mt-12">
        <div className="grid gap-10 sm:grid-cols-3 max-w-6xl mx-auto">
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
                  href="/e/sandbox/fleet"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                >
                  Cohort fleet (sandbox)
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

          <div>
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
              Stack
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-secondary">
              <li>Gemini 2.5 Pro / Flash</li>
              <li>Google ADK · TypeScript</li>
              <li>Cloud Run · Firestore</li>
              <li>Secret Manager · Cloud Build</li>
              <li>Telegram · WhatsApp (soon)</li>
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
