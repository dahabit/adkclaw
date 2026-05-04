import { forwardRef, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-mono text-xs uppercase tracking-[0.12em] text-ink-tertiary"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          'h-11 px-4 rounded-md bg-bg-inset border text-ink-primary placeholder:text-ink-tertiary',
          'transition-colors duration-fast ease-out',
          'focus:outline-none focus:border-accent focus:bg-bg-surface',
          error ? 'border-status-error' : 'border-border-subtle hover:border-border-strong',
          className,
        ].join(' ')}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-ink-tertiary">{hint}</p>}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
});
