import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AdkClaw — Build your AI teammate on Google ADK',
    short_name: 'AdkClaw',
    description:
      'A 5-level workshop teaching autonomous agents on Google ADK + Gemini in TypeScript. ' +
      'From console.log to globally-reachable autonomous agent on Cloud Run in 9.5 hours.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e1a',
    theme_color: '#0a0e1a',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['education', 'developer', 'productivity'],
  };
}
