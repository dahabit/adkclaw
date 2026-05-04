import type { Metadata } from 'next';
import '../styles/globals.css';
import { CosmicBackground } from '@/components/ui/CosmicBackground';

export const metadata: Metadata = {
  title: 'AdkClaw — Build your AI teammate on Google ADK',
  description:
    'A 5-level workshop teaching autonomous agents on Google ADK + Gemini in TypeScript. ' +
    'From console.log to globally-reachable autonomous agent on Cloud Run in 9.5 hours.',
  metadataBase: new URL('https://adkclaw.dev'),
  openGraph: {
    title: 'AdkClaw — Build your AI teammate',
    description: 'Build an autonomous AI agent on Google Cloud. 5 levels. Open source. Apache 2.0.',
    url: 'https://adkclaw.dev',
    siteName: 'AdkClaw',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AdkClaw — Build your AI teammate',
    description: 'Build an autonomous AI agent on Google Cloud. 5 levels. Open source.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="font-body antialiased">
        <CosmicBackground />
        {children}
      </body>
    </html>
  );
}
