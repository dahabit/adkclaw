'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Pre-flight check — students hit this before joining their first cohort.
 * Pure client-side: validates the FORMAT of credentials, never sends them anywhere.
 * Saves to localStorage so a refresh doesn't lose progress.
 */

interface Field {
  id: 'gcpProject' | 'geminiKey' | 'tgBotToken' | 'tgUserId';
  label: string;
  hint: string;
  link: { href: string; label: string };
  pattern: RegExp;
  placeholder: string;
  /** masked input (don't show typed chars) */
  secret?: boolean;
}

const FIELDS: Field[] = [
  {
    id: 'gcpProject',
    label: 'Google Cloud project ID',
    hint: 'Lowercase letters, numbers, hyphens. 6–30 chars.',
    link: {
      href: 'https://console.cloud.google.com/projectcreate',
      label: 'Create a project',
    },
    pattern: /^[a-z][-a-z0-9]{4,28}[a-z0-9]$/,
    placeholder: 'my-first-adkclaw',
  },
  {
    id: 'geminiKey',
    label: 'Gemini API key',
    hint: 'Starts with “AI…”. Free tier from Google AI Studio.',
    link: {
      href: 'https://aistudio.google.com/apikey',
      label: 'Get a free key',
    },
    pattern: /^AI[A-Za-z0-9_-]{30,80}$/,
    placeholder: 'AIza...',
    secret: true,
  },
  {
    id: 'tgBotToken',
    label: 'Telegram bot token',
    hint: 'Format: <number>:<35-char string>. From @BotFather.',
    link: {
      href: 'https://t.me/BotFather',
      label: 'Open BotFather',
    },
    pattern: /^\d{6,12}:[A-Za-z0-9_-]{30,}$/,
    placeholder: '1234567890:ABCdef...',
    secret: true,
  },
  {
    id: 'tgUserId',
    label: 'Your Telegram numeric ID',
    hint: 'A pure number (no @username). Forward a message to @userinfobot.',
    link: {
      href: 'https://t.me/userinfobot',
      label: 'Get your numeric ID',
    },
    pattern: /^\d{4,15}$/,
    placeholder: '5025183377',
  },
];

const STORAGE_KEY = 'adkclaw:preflight';

type State = Record<Field['id'], string>;

function loadState(): State {
  if (typeof window === 'undefined') {
    return { gcpProject: '', geminiKey: '', tgBotToken: '', tgUserId: '' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      gcpProject: parsed.gcpProject ?? '',
      geminiKey: parsed.geminiKey ?? '',
      tgBotToken: parsed.tgBotToken ?? '',
      tgUserId: parsed.tgUserId ?? '',
    };
  } catch {
    return { gcpProject: '', geminiKey: '', tgBotToken: '', tgUserId: '' };
  }
}

export default function PreflightPage() {
  const [state, setState] = useState<State>({
    gcpProject: '',
    geminiKey: '',
    tgBotToken: '',
    tgUserId: '',
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const checks = FIELDS.map((f) => ({
    field: f,
    value: state[f.id],
    valid: state[f.id].length > 0 && f.pattern.test(state[f.id]),
  }));
  const passed = checks.filter((c) => c.valid).length;
  const allGreen = passed === FIELDS.length;

  function clearAll() {
    setState({ gcpProject: '', geminiKey: '', tgBotToken: '', tgUserId: '' });
  }

  return (
    <main className="min-h-dvh container-wide pt-32 pb-20">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="text-center mb-10">
          <p className="text-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
            Pre-flight check
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-primary mb-3">
            Before you join your first cohort
          </h1>
          <p className="text-ink-secondary leading-relaxed">
            Four credentials to gather. None of them leave this browser — we only check the format.
            Takes about <strong className="text-ink-primary">10 minutes</strong>.
          </p>
        </header>

        {/* Progress */}
        <div className="surface rounded-xl p-4 mb-8 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <p className="text-mono text-xs uppercase tracking-[0.15em] text-ink-tertiary">
                Progress
              </p>
              <p className="text-mono text-xs text-accent font-semibold">
                {passed} / {FIELDS.length}
              </p>
            </div>
            <div className="h-1.5 bg-bg-deep rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent via-indigo-400 to-cyan-400 transition-all duration-medium ease-out"
                style={{ width: `${(passed / FIELDS.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="text-mono text-[10px] uppercase tracking-wider text-ink-tertiary hover:text-accent transition-colors duration-fast ease-out"
          >
            Clear
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4 mb-10">
          {checks.map(({ field, value, valid }) => (
            <article
              key={field.id}
              className={[
                'surface rounded-xl p-5 transition-colors duration-fast ease-out border-2',
                value.length === 0
                  ? 'border-border-subtle'
                  : valid
                    ? 'border-status-progress'
                    : 'border-status-error',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <label
                  htmlFor={field.id}
                  className="font-display text-base font-semibold text-ink-primary"
                >
                  {field.label}
                </label>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm flex-none"
                  style={{
                    background:
                      value.length === 0
                        ? 'rgba(154,163,184,0.15)'
                        : valid
                          ? 'rgba(16,185,129,0.25)'
                          : 'rgba(239,68,68,0.25)',
                    color: value.length === 0 ? '#6b7390' : valid ? '#10b981' : '#ef4444',
                  }}
                  aria-label={value.length === 0 ? 'empty' : valid ? 'valid' : 'invalid format'}
                >
                  {value.length === 0 ? '○' : valid ? '✓' : '!'}
                </span>
              </div>
              <p className="text-ink-tertiary text-xs mb-3">{field.hint}</p>
              <input
                id={field.id}
                type={field.secret ? 'password' : 'text'}
                value={value}
                onChange={(e) => setState((s) => ({ ...s, [field.id]: e.target.value.trim() }))}
                placeholder={field.placeholder}
                autoComplete="off"
                spellCheck={false}
                className={[
                  'w-full px-3 py-2 rounded-md font-mono text-sm',
                  'bg-bg-inset border border-border-subtle text-ink-primary',
                  'placeholder:text-ink-tertiary focus:border-accent focus:outline-none',
                  'transition-colors duration-fast ease-out',
                ].join(' ')}
              />
              <Link
                href={field.link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline"
              >
                <span aria-hidden>↗</span> {field.link.label}
              </Link>
            </article>
          ))}
        </div>

        {/* Privacy note */}
        <div className="surface rounded-lg p-4 mb-8">
          <p className="text-mono text-xs uppercase tracking-[0.15em] text-accent mb-2">Privacy</p>
          <p className="text-ink-secondary text-xs leading-relaxed">
            Everything you type stays on your device (browser localStorage). We never POST these
            values anywhere. The only purpose of this page is to check the FORMAT of your inputs so
            you don't waste time in Cloud Shell on a typo.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          {allGreen ? (
            <Link href="/join/sandbox" className="btn-hero text-base inline-flex items-center">
              All set — join the sandbox →
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="btn-hero text-base inline-flex items-center opacity-40 cursor-not-allowed"
              title="Fill all four fields with valid formats"
            >
              {passed} of {FIELDS.length} ready
            </button>
          )}
          <p className="text-ink-tertiary text-xs mt-4">
            Bring these four values into Cloud Shell when your session starts. Run{' '}
            <code className="text-mono text-accent">./scripts/setup.sh</code> and paste them when
            prompted.
          </p>
        </div>
      </div>
    </main>
  );
}
