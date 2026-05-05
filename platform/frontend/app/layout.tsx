import type { Metadata } from 'next';
import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import { CosmicBackground } from '@/components/ui/CosmicBackground';

const fontDisplay = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const fontBody = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AdkClaw — Build your AI teammate on Google ADK',
  description:
    'A 5-level workshop teaching autonomous agents on Google ADK + Gemini in TypeScript. ' +
    'From console.log to globally-reachable autonomous agent on Cloud Run in 9.5 hours.',
  metadataBase: new URL('https://adkclaw.dev'),
  applicationName: 'AdkClaw',
  authors: [{ name: 'Ahmed Abu Eldahab', url: 'https://x.com/dahabdev' }],
  creator: 'Ahmed Abu Eldahab',
  publisher: 'Ahmed Abu Eldahab',
  keywords: [
    'Google ADK',
    'Gemini',
    'autonomous agent',
    'AI workshop',
    'TypeScript',
    'Cloud Run',
    'function calling',
    'multi-agent',
    'GDE',
  ],
  alternates: {
    canonical: 'https://adkclaw.dev',
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title: 'AdkClaw — Build your AI teammate',
    description: 'Build an autonomous AI agent on Google Cloud. 5 levels. Open source. Apache 2.0.',
    url: 'https://adkclaw.dev',
    siteName: 'AdkClaw',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AdkClaw — Autonomous AI Agents on Google ADK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AdkClaw — Build your AI teammate',
    description: 'Build an autonomous AI agent on Google Cloud. 5 levels. Open source.',
    site: '@dahabdev',
    creator: '@dahabdev',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: import('next').Viewport = {
  themeColor: '#0a0e1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body className="font-body antialiased">
        <CosmicBackground />
        {children}
      </body>
    </html>
  );
}
