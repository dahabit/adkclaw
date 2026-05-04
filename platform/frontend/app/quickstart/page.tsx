import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export const metadata = {
  title: 'Quickstart — AdkClaw',
  description: '5 minutes from zero to a running AdkClaw agent in your browser via Cloud Shell.',
};

export default function QuickstartPage() {
  return (
    <main className="min-h-dvh container-page py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-mono text-sm uppercase tracking-[0.18em] text-accent mb-4">
          5-minute taste
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-4">
          Run AdkClaw in your browser, right now
        </h1>
        <p className="text-lg text-ink-secondary mb-12 leading-relaxed">
          No install. No setup. Open Google Cloud Shell, paste a command, see the reference agent
          run end-to-end. If you like it, then commit to the full 5-level workshop.
        </p>

        {/* Step 1 */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3">
            <span className="text-accent">1.</span> Open Cloud Shell
          </h2>
          <p className="text-ink-secondary mb-4 text-sm">
            Click the button below — Google opens Cloud Shell with this repo pre-cloned.
          </p>
          <Link
            href="https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/dahabit/adkclaw.git&cloudshell_workspace=."
            target="_blank"
            rel="noreferrer noopener"
          >
            <Button size="lg">Open in Cloud Shell ↗</Button>
          </Link>
          <p className="text-ink-tertiary text-xs mt-3">
            Requires a Google account. Cloud Shell is free — 50 hours/week.
          </p>
        </section>

        {/* Step 2 */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3">
            <span className="text-accent">2.</span> Configure your keys
          </h2>
          <p className="text-ink-secondary mb-3 text-sm">
            In the Cloud Shell terminal, run the setup wizard:
          </p>
          <pre className="bg-bg-inset border border-border-subtle rounded-md p-4 text-sm text-ink-primary overflow-x-auto">
            <code>{`cd ~/cloudshell_open/adkclaw
npm install
npm run setup`}</code>
          </pre>
          <p className="text-ink-tertiary text-xs mt-3">
            You&apos;ll need a free{' '}
            <Link
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              Gemini API key
            </Link>{' '}
            and a{' '}
            <Link
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              Telegram bot token
            </Link>{' '}
            (both free, both 30 seconds to obtain).
          </p>
        </section>

        {/* Step 3 */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3">
            <span className="text-accent">3.</span> Start the daemon
          </h2>
          <pre className="bg-bg-inset border border-border-subtle rounded-md p-4 text-sm text-ink-primary overflow-x-auto">
            <code>npm run dev</code>
          </pre>
          <p className="text-ink-secondary text-sm mt-3">
            Send <code className="text-mono text-xs bg-bg-inset px-1.5 py-0.5 rounded">/start</code>{' '}
            to your bot on Telegram, copy the numeric ID it replies with, paste into{' '}
            <code className="text-mono text-xs bg-bg-inset px-1.5 py-0.5 rounded">.env</code> as{' '}
            <code className="text-mono text-xs bg-bg-inset px-1.5 py-0.5 rounded">
              ALLOWED_SENDERS
            </code>
            , restart, and chat.
          </p>
        </section>

        {/* What happens */}
        <section className="surface rounded-lg p-6 mb-10">
          <h2 className="font-display text-lg font-semibold mb-4">
            What you&apos;ll have in 5 minutes
          </h2>
          <ul className="text-ink-secondary text-sm space-y-2 leading-relaxed">
            <li>✓ A working agent on Telegram with a name + personality</li>
            <li>✓ Tools: web search, URL fetch, filesystem read/write</li>
            <li>✓ Conversation memory in SQLite (survives restarts)</li>
            <li>
              ✓ A live dashboard at <code className="text-mono text-xs">localhost:3000</code>
            </li>
          </ul>
        </section>

        {/* Convince */}
        <section className="text-center pt-8 border-t border-border-subtle">
          <p className="text-ink-secondary mb-6">
            Like what you see? Commit to the full 5-level workshop and ship to Cloud Run.
          </p>
          <Link href="/join/sandbox">
            <Button size="lg">Join the sandbox cohort →</Button>
          </Link>
        </section>
      </div>
    </main>
  );
}
