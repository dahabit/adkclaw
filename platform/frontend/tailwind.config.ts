import type { Config } from 'tailwindcss';

/**
 * AdkClaw design system — Style A (Cosmic Workshop)
 * Tinted neutrals (NOT pure black/gray), cloud-blue accent, gold for deployed beacons.
 * Fully Impeccable-compliant: no purple gradients, no Inter/Roboto, fluid type, ease-out only.
 */

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Slate-blue tinted neutrals — never pure black/gray
        bg: {
          deep: '#0a0e1a', // page background
          surface: '#131a2c', // card surface
          raised: '#1c2540', // elevated surface
          inset: '#080c14', // recessed/inputs
        },
        ink: {
          primary: '#e8ecf2', // warm off-white
          secondary: '#9aa3b8', // slate-tinted
          tertiary: '#6b7390', // muted slate
        },
        accent: {
          DEFAULT: '#3B82F6', // cloud blue
          hover: '#60A5FA',
          muted: 'rgba(59, 130, 246, 0.12)',
          ring: 'rgba(59, 130, 246, 0.4)',
        },
        status: {
          idle: '#f59e0b', // amber — registered no levels
          progress: '#10b981', // emerald — in progress
          deployed: '#facc15', // gold + glow — Level 4
          error: '#ef4444', // tinted red
        },
        border: {
          subtle: 'rgba(154, 163, 184, 0.12)',
          strong: 'rgba(154, 163, 184, 0.24)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        // Fluid type scale via clamp()
        xs: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        sm: 'clamp(0.875rem, 0.8rem + 0.375vw, 1rem)',
        base: 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',
        lg: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
        xl: 'clamp(1.5rem, 1.3rem + 1vw, 1.875rem)',
        '2xl': 'clamp(2rem, 1.7rem + 1.5vw, 2.5rem)',
        '3xl': 'clamp(2.75rem, 2.2rem + 2.75vw, 4rem)',
        '4xl': 'clamp(3.5rem, 2.8rem + 3.5vw, 5rem)',
      },
      spacing: {
        // 4px base scale
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem',
        '24': '6rem',
        '32': '8rem',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
      },
      transitionTimingFunction: {
        // No bounce — only ease-out / in-out / mild spring
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        medium: '280ms',
        slow: '500ms',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(59, 130, 246, 0.4)',
        'glow-gold': '0 0 24px -2px rgba(250, 204, 21, 0.5)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 12px rgba(0,0,0,0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        aurora: 'aurora 24s ease-in-out infinite',
        'aurora-slow': 'aurora 38s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px -2px rgba(250, 204, 21, 0.4)' },
          '50%': { boxShadow: '0 0 24px -2px rgba(250, 204, 21, 0.8)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(8%,-6%,0) scale(1.1)' },
          '66%': { transform: 'translate3d(-6%,4%,0) scale(0.95)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.55)' },
          '70%': { boxShadow: '0 0 0 14px rgba(59,130,246,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
