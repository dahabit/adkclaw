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
    prereq: 'No prerequisites',
    outcome: '📚 Understand autonomous agents',
  },
  {
    id: 1,
    title: 'Build the Brain',
    desc: 'Agent loop, tools, personality, Telegram, sessions.',
    dur: '120 min',
    tag: 'Foundations',
    prereq: 'Node.js basics · Telegram account',
    outcome: '🤖 Your agent talks on Telegram',
  },
  {
    id: 2,
    title: 'Memory & Skills',
    desc: 'Context bootstrap, memory bank, compaction, runtime skills.',
    dur: '120 min',
    tag: 'Cognition',
    prereq: 'L1 complete',
    outcome: '🧠 Your agent remembers you',
  },
  {
    id: 3,
    title: 'The Agent Army',
    desc: 'Sub-agents, recovery pyramid, cron, dashboard.',
    dur: '120 min',
    tag: 'Autonomy',
    prereq: 'L2 complete',
    outcome: '👥 Your agent has a team',
  },
  {
    id: 4,
    title: 'Ship to the Cloud',
    desc: 'Cloud Run, Firestore, Secret Manager, webhook.',
    dur: '150 min',
    tag: 'Production',
    prereq: 'L3 complete · Google Cloud account',
    outcome: '🚀 Your agent runs 24/7',
  },
];

const CAPABILITIES = [
  {
    icon: '💬',
    title: 'Telegram Agent',
    detail: 'Chat with your agent from your phone, 24/7.',
    example: '"Summarise my day."',
  },
  {
    icon: '🔍',
    title: 'Web Search',
    detail: 'Live grounding via Gemini Search.',
    example: '"What happened in tech today?"',
  },
  {
    icon: '📄',
    title: 'Create Content',
    detail: 'PDFs, slide decks, reports — generated on demand.',
    example: '"Make a 5-slide deck on Google ADK."',
  },
  {
    icon: '⏰',
    title: 'Scheduled Tasks',
    detail: 'Cron-driven work the agent runs without you.',
    example: '"Every weekday at 9am, brief me on Flutter news."',
  },
  {
    icon: '🧠',
    title: 'Persistent Memory',
    detail: 'Survives reboots and grows over time.',
    example: '"Remember I prefer SQLite for v1 projects."',
  },
  {
    icon: '🤝',
    title: 'Sub-Agents',
    detail: 'Delegates specialised work to focused sub-agents.',
    example: '"Research Vertex Vector Search and save findings."',
  },
];

const AUDIENCES = [
  {
    icon: '👩‍💻',
    title: 'TypeScript / Node Developers',
    detail:
      'You know async/await — now learn agent loops. Move from API calls to autonomous agents.',
  },
  {
    icon: '🎓',
    title: 'CS Students & Bootcamp Grads',
    detail:
      'Understand AI from first principles. Real agent architecture, not just prompt engineering.',
  },
  {
    icon: '🧑‍🏫',
    title: 'Community Leads & Instructors',
    detail:
      'Want to teach AI agents at your local GDG, university, or meetup. Train-the-trainer ready.',
  },
  {
    icon: '🏢',
    title: 'Teams Exploring AI Agents',
    detail: 'Evaluate if autonomous agents fit your product. Build a proof-of-concept in one day.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh">
      <TopNav />

      {/* === Hero === */}
      <section
        id="home"
        className="container-wide pt-24 pb-12 sm:pt-28 sm:pb-16 relative scroll-mt-20"
      >
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-mono text-[11px] sm:text-xs uppercase tracking-[0.28em] text-accent mb-5">
            Google ADK · Gemini · TypeScript
          </p>
          <h1 className="font-display font-bold text-ink-primary mb-4 leading-[0.95] tracking-tight text-[clamp(2.5rem,4.5vw+0.5rem,4.5rem)]">
            <span className="block hero-shimmer">
              {'Build your AI teammate.'.split(' ').map((word, i) => (
                <span
                  key={`l1-${i}`}
                  className="hero-word"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {word}
                  {i < 'Build your AI teammate.'.split(' ').length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
            <span className="block hero-gradient-text">
              {'From a function call to global autonomy.'.split(' ').map((word, i) => (
                <span
                  key={`l2-${i}`}
                  className="hero-word"
                  style={{ animationDelay: `${360 + i * 70}ms` }}
                >
                  {word}
                  {i < 'From a function call to global autonomy.'.split(' ').length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
          </h1>
          <FadeIn delay={780}>
            <p className="text-base sm:text-lg text-ink-secondary mb-7 leading-relaxed max-w-2xl mx-auto">
              A 5-level workshop teaching autonomous AI agents on Google ADK + Gemini. From{' '}
              <code className="text-mono text-accent">console.log</code> to a globally-reachable
              agent running on Google Cloud — yours to chat with from anywhere.
            </p>
          </FadeIn>
          <FadeIn delay={920}>
            <div className="flex flex-wrap justify-center gap-3">
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
          <p className="text-ink-secondary text-center mb-14 max-w-2xl mx-auto">
            Each level adds a pillar. By Level 4 your agent runs 24/7 on Google Cloud, reachable
            from any phone.
          </p>
        </FadeIn>
        <div className="levels-timeline mx-auto max-w-4xl">
          {LEVELS.map((lvl, i) => (
            <FadeIn key={lvl.id} delay={i * 100}>
              <div className={`level-row ${`level-glow-${lvl.id}`} mb-10 sm:mb-12 last:mb-0`}>
                <span className="level-node" aria-hidden="true">
                  L{lvl.id}
                </span>
                <article className="surface rounded-lg p-6 sm:p-7 level-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                    <h3 className="font-display text-xl sm:text-2xl font-semibold text-ink-primary">
                      {lvl.title}
                    </h3>
                    <p className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                      {lvl.tag}
                    </p>
                  </div>
                  <p className="text-ink-secondary text-base leading-relaxed mb-5">{lvl.desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                    <div>
                      <p className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">
                        Prereq
                      </p>
                      <p className="text-mono text-xs sm:text-sm text-ink-secondary">
                        {lvl.prereq}
                      </p>
                    </div>
                    <div>
                      <p className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">
                        Outcome
                      </p>
                      <p className="text-sm font-semibold text-accent">{lvl.outcome}</p>
                    </div>
                  </div>
                </article>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* === What you'll build === */}
      <section id="capabilities" className="container-wide py-16 sm:py-20 scroll-mt-20">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary mb-3">
              What you&apos;ll build
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              By Level 4 your agent has these capabilities — every one a tool the workshop teaches
              you to wire and operate.
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {CAPABILITIES.map((c, i) => (
            <FadeIn key={c.title} delay={i * 60}>
              <article className="surface rounded-lg p-5 h-full">
                <div className="text-2xl mb-3" aria-hidden="true">
                  {c.icon}
                </div>
                <h3 className="font-display text-base font-semibold mb-2 text-ink-primary">
                  {c.title}
                </h3>
                <p className="text-ink-secondary text-sm leading-relaxed mb-3">{c.detail}</p>
                <p className="text-mono text-xs text-ink-tertiary italic">{c.example}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* === Who is this for? === */}
      <section id="audience" className="container-wide py-16 sm:py-20 scroll-mt-20">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary mb-3">
              Who is this for?
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              Designed for developers, students, instructors, and teams who want real agent
              architecture — not just prompt engineering.
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {AUDIENCES.map((a, i) => (
            <FadeIn key={a.title} delay={i * 80}>
              <article className="surface rounded-lg p-5 h-full">
                <div className="text-2xl mb-3" aria-hidden="true">
                  {a.icon}
                </div>
                <h3 className="font-display text-base font-semibold mb-2 text-ink-primary">
                  {a.title}
                </h3>
                <p className="text-ink-secondary text-sm leading-relaxed">{a.detail}</p>
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
              Google Technologies
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              Production-grade Google Cloud services. Every layer is something the workshop teaches
              you to operate. AdkClaw is community-built and not officially affiliated with Google.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={120}>
          <TechRail />
        </FadeIn>
      </section>

      {/* === About === */}
      <section id="about" className="container-wide py-16 scroll-mt-20">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-primary mb-3">
              About AdkClaw
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              An open-source workshop by Google Developer Expert{' '}
              <span className="text-ink-primary font-semibold">Ahmed Abu Eldahab</span> — built to
              teach students how to design and ship autonomous AI agents the right way, from first
              principles to production on Google Cloud.
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
          <div className="flex flex-wrap justify-center items-center gap-4">
            <Link href="/join/sandbox" className="btn-hero text-base inline-flex items-center">
              Join the sandbox →
            </Link>
          </div>
        </section>
      </FadeIn>

      {/* === Footer === */}
      <footer className="container-wide border-t border-border-subtle py-12 mt-12">
        <div className="grid gap-10 sm:grid-cols-4 max-w-6xl mx-auto">
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
                target="_blank"
                rel="noreferrer noopener"
              >
                Apache 2.0
              </Link>
              .
            </p>
            <p className="text-ink-tertiary text-xs mt-3 leading-relaxed">
              Built for the global developer community, with special focus on MENA.
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
              Google Technologies
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-secondary">
              <li>Gemini · Google ADK</li>
              <li>Vertex AI · Cloud Run</li>
              <li>Firestore · Firebase</li>
              <li>Cloud Build · Secret Manager</li>
              <li>Cloud Scheduler</li>
            </ul>
          </div>

          <div>
            <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary mb-3">
              Connect
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li>
                <Link
                  href="https://x.com/dahabdev"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  X / Twitter
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.linkedin.com/in/dahabit/"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  LinkedIn
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.youtube.com/@h3boh3bo"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  YouTube
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.facebook.com/dahabdev"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Facebook
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.instagram.com/dahabdev"
                  className="text-ink-secondary hover:text-accent transition-colors duration-fast ease-out"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Instagram
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border-subtle text-center text-ink-tertiary text-xs leading-relaxed">
          AdkClaw is community-built and not officially affiliated with Google.
          <br />© {new Date().getFullYear()} Ahmed Abu Eldahab · adkclaw.dev · Built with Google ADK
          + Gemini
        </div>
      </footer>
    </main>
  );
}
