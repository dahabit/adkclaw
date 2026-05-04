import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-accent text-bg-deep font-semibold hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_24px_-6px_rgba(59,130,246,0.4)]',
  secondary:
    'bg-bg-raised text-ink-primary border border-border-strong hover:border-accent hover:bg-bg-surface disabled:opacity-50',
  ghost:
    'bg-transparent text-ink-secondary hover:text-ink-primary hover:bg-bg-surface disabled:opacity-50',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-5 text-base rounded-md',
  lg: 'h-12 px-7 text-base rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, children, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center gap-2 transition-all duration-fast ease-out',
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(' ')}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="inline-block animate-pulse">…</span> : children}
    </button>
  );
});
