'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';
import { api, ApiError } from '@/lib/api';
import type { AvatarPreset, RegisterBuilderResponse } from '@/lib/types';

export default function JoinPage() {
  const params = useParams<{ event: string }>();
  const eventCode = params.event;

  const [eventName, setEventName] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<AvatarPreset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterBuilderResponse | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  // Fetch event metadata
  useEffect(() => {
    let cancelled = false;
    api
      .getEvent(eventCode)
      .then((event) => {
        if (cancelled) return;
        setEventName(event.name);
        setEventLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'event_not_found') {
          setEventError(`Event '${eventCode}' not found. Check your invite link.`);
        } else {
          setEventError('Could not reach the workshop API. Try again in a moment.');
        }
        setEventLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventCode]);

  const usernameValid = /^[a-zA-Z0-9_-]{2,20}$/.test(username);
  const canSubmit = usernameValid && avatar !== null && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !avatar) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.registerBuilder({
        eventCode,
        username,
        avatarPreset: avatar,
      });
      setSuccess(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'username_taken') {
          setSubmitError(`Username '${username}' is already taken. Try another.`);
        } else if (err.code === 'event_at_capacity') {
          setSubmitError('This event is full. Sorry — try the sandbox instead.');
        } else if (err.code === 'event_closed') {
          setSubmitError('This event has closed. Registration is no longer open.');
        } else {
          setSubmitError(`Registration failed: ${err.code}`);
        }
      } else {
        setSubmitError('Could not reach the API. Check your connection.');
      }
      setSubmitting(false);
    }
  }

  if (eventLoading) {
    return (
      <main className="min-h-dvh container-page py-24">
        <p className="text-center text-ink-tertiary">Spinning up your registration…</p>
      </main>
    );
  }

  if (eventError) {
    const isSandbox = eventCode === 'sandbox';
    return (
      <main className="min-h-dvh container-page py-24 text-center">
        <h1 className="font-display text-2xl mb-4">
          {isSandbox ? 'No live cohort right now' : 'Event not available'}
        </h1>
        <p className="text-ink-secondary mb-8 max-w-xl mx-auto">
          {isSandbox
            ? 'There is no live AdkClaw cohort active at the moment. You can still go self-paced — the entire workshop is open-source and the curriculum lives in the public repo.'
            : eventError}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {isSandbox ? (
            <>
              <Link
                href="https://github.com/dahabit/adkclaw#level_0"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Button>Begin Level 0 (self-paced) →</Button>
              </Link>
              <Link
                href="https://forms.gle/ADKCLAW_WAITLIST"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Button variant="secondary">Join the waitlist</Button>
              </Link>
              <Link href="/">
                <Button variant="ghost">Back to home</Button>
              </Link>
            </>
          ) : (
            <Link href="/">
              <Button variant="secondary">Back to home</Button>
            </Link>
          )}
        </div>
      </main>
    );
  }

  // Success state — show the HMAC secret + setup instructions
  if (success) {
    return (
      <main className="min-h-dvh container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <p className="text-mono text-sm uppercase tracking-[0.18em] text-status-progress mb-4">
            ✓ Registered
          </p>
          <h1 className="text-2xl font-display font-bold mb-4">Welcome, {success.username}</h1>
          <p className="text-ink-secondary mb-8">
            Your builder identity is reserved on <span className="text-accent">{eventName}</span>.
            Save the secret below — it won&apos;t be shown again.
          </p>

          <div className="surface rounded-lg p-6 mb-8">
            <p className="text-mono text-xs uppercase tracking-[0.12em] text-status-deployed mb-3">
              ⚠ Your one-time HMAC secret
            </p>
            <div className="bg-bg-inset rounded-md p-4 mb-3 font-mono text-sm text-ink-primary break-all">
              {success.hmacSecret}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(success.hmacSecret).catch(() => null);
                setSecretCopied(true);
                setTimeout(() => setSecretCopied(false), 2000);
              }}
            >
              {secretCopied ? '✓ Copied' : 'Copy secret'}
            </Button>
          </div>

          <div className="surface rounded-lg p-6 mb-8">
            <h2 className="font-display text-lg font-semibold mb-3">Next: clone & configure</h2>
            <ol className="text-ink-secondary text-sm space-y-3 leading-relaxed">
              <li>
                <span className="text-mono text-xs text-accent">1.</span> Clone the repo:
                <pre className="bg-bg-inset rounded-md p-3 mt-1 text-xs overflow-x-auto text-ink-primary">
                  git clone https://github.com/dahabit/adkclaw.git{'\n'}cd adkclaw
                </pre>
              </li>
              <li>
                <span className="text-mono text-xs text-accent">2.</span> Copy{' '}
                <code className="text-mono text-xs bg-bg-inset px-1.5 py-0.5 rounded">
                  .env.example
                </code>{' '}
                to <code className="text-mono text-xs bg-bg-inset px-1.5 py-0.5 rounded">.env</code>{' '}
                and add:
                <pre className="bg-bg-inset rounded-md p-3 mt-1 text-xs overflow-x-auto text-ink-primary">
                  ADKCLAW_USERNAME={success.username}
                  {'\n'}ADKCLAW_BUILDER_SECRET={success.hmacSecret.slice(0, 12)}…
                </pre>
              </li>
              <li>
                <span className="text-mono text-xs text-accent">3.</span> Start with{' '}
                <Link href="/levels" className="text-accent hover:underline">
                  Level 0 — Architecture Tour
                </Link>
              </li>
            </ol>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Link href={`/u/${success.username}`}>
              <Button>View my profile →</Button>
            </Link>
            <Link href="/quickstart">
              <Button variant="secondary">5-min Quickstart</Button>
            </Link>
          </div>

          {/* Share strip — invite the new builder to share */}
          <div className="surface rounded-lg p-6 mt-8">
            <p className="text-mono text-xs uppercase tracking-[0.18em] text-accent mb-2">
              📸 You&apos;re in. Tell the world.
            </p>
            <p className="text-ink-secondary text-sm mb-4 leading-relaxed">
              Share that you&apos;re building your AI teammate — tag{' '}
              <span className="text-mono text-accent">#AdkClaw</span> so others can find you.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Building my AI teammate with AdkClaw 🤖 5 levels, Google ADK + Gemini, ships to MY Cloud Run. #AdkClaw #GoogleADK`,
                )}&url=${encodeURIComponent('https://adkclaw.dev')}&via=dahabdev`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Button variant="secondary" size="sm">
                  Share on X →
                </Button>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                  'https://adkclaw.dev',
                )}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Button variant="secondary" size="sm">
                  Share on LinkedIn →
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Registration form
  return (
    <main className="min-h-dvh container-page py-16 sm:py-24">
      <div className="mx-auto max-w-xl">
        <p className="text-mono text-sm uppercase tracking-[0.18em] text-accent mb-4">
          Joining: {eventName}
        </p>
        <h1 className="text-2xl font-display font-bold mb-3">Pick your builder identity</h1>
        <p className="text-ink-secondary mb-10">
          Your username + avatar appear on the cohort fleet. Pick something you&apos;ll be proud of
          — your agent will inherit the personality.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <Input
            name="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ahmed-from-egypt"
            hint="2-20 characters · letters, numbers, dashes, underscores"
            autoComplete="off"
            spellCheck={false}
            required
          />

          <AvatarPicker value={avatar} onChange={setAvatar} />

          {submitError && (
            <div className="rounded-md border border-status-error bg-bg-inset p-3 text-sm text-status-error">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" size="lg" loading={submitting} disabled={!canSubmit}>
              {submitting ? 'Registering…' : 'Reserve my identity →'}
            </Button>
            <Link href="/">
              <Button type="button" variant="ghost" size="lg">
                Cancel
              </Button>
            </Link>
          </div>

          <p className="text-xs text-ink-tertiary leading-relaxed">
            By registering you agree that AdkClaw stores only your username, event code, and badge
            progress. Your Gemini API key, Telegram bot token, and Cloud Run deployments live on
            your own Google Cloud project — we never see them.
          </p>
        </form>
      </div>
    </main>
  );
}
