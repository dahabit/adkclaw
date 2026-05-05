import type { MetadataRoute } from 'next';

const BASE = 'https://adkclaw.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/quickstart`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/join/sandbox`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
