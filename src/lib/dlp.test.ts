import { describe, it, expect, beforeEach } from 'vitest';
import { redactPii, resetDlpClient } from './dlp.js';

describe('redactPii', () => {
  beforeEach(() => {
    resetDlpClient();
  });

  it('returns input unchanged when GOOGLE_CLOUD_PROJECT is missing', async () => {
    const orig = process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    const out = await redactPii('contact me at user@example.com');
    expect(out).toBe('contact me at user@example.com');
    process.env.GOOGLE_CLOUD_PROJECT = orig;
  });

  it('returns input unchanged when @google-cloud/dlp is not installed', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    // @google-cloud/dlp is not a dependency in the test environment, so the
    // dynamic import will fail and redactPii falls back to identity.
    const out = await redactPii('contact me at user@example.com');
    expect(out).toBe('contact me at user@example.com');
  });

  it('returns empty input unchanged', async () => {
    const out = await redactPii('');
    expect(out).toBe('');
  });
});
