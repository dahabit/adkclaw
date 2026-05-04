/**
 * Unit tests for Zod request schemas.
 */

import { describe, it, expect } from 'vitest';
import { createEventSchema, registerBuilderSchema, badgeSchema } from './validate.js';

describe('createEventSchema', () => {
  const valid = {
    code: 'agentcon2026',
    name: 'AgentCon 2026',
    startsAt: '2026-06-15T00:00:00Z',
    endsAt: '2026-06-22T23:59:59Z',
    capacity: 500,
    instructorToken: 'shhh-strong-token',
  };

  it('accepts a valid event', () => {
    expect(createEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects uppercase event codes', () => {
    expect(createEventSchema.safeParse({ ...valid, code: 'AgentCon' }).success).toBe(false);
  });

  it('rejects capacity > 10000', () => {
    expect(createEventSchema.safeParse({ ...valid, capacity: 100000 }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(createEventSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(createEventSchema.safeParse({ ...valid, startsAt: 'tomorrow' }).success).toBe(false);
  });
});

describe('registerBuilderSchema', () => {
  const valid = {
    eventCode: 'sandbox',
    username: 'ahmed-from-egypt',
    avatarPreset: 'chrome' as const,
  };

  it('accepts a valid registration', () => {
    expect(registerBuilderSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts underscores and hyphens in username', () => {
    expect(registerBuilderSchema.safeParse({ ...valid, username: 'ahmed_dev-2026' }).success).toBe(
      true,
    );
  });

  it('rejects username < 2 chars', () => {
    expect(registerBuilderSchema.safeParse({ ...valid, username: 'a' }).success).toBe(false);
  });

  it('rejects username > 20 chars', () => {
    expect(registerBuilderSchema.safeParse({ ...valid, username: 'a'.repeat(21) }).success).toBe(
      false,
    );
  });

  it('rejects spaces in username', () => {
    expect(registerBuilderSchema.safeParse({ ...valid, username: 'has space' }).success).toBe(
      false,
    );
  });

  it('rejects invalid avatar preset', () => {
    expect(registerBuilderSchema.safeParse({ ...valid, avatarPreset: 'rainbow' }).success).toBe(
      false,
    );
  });
});

describe('badgeSchema', () => {
  it('accepts a minimal badge', () => {
    expect(badgeSchema.safeParse({ level: 1 }).success).toBe(true);
  });

  it('accepts a level-4 badge with all optional fields', () => {
    expect(
      badgeSchema.safeParse({
        level: 4,
        agentName: 'Dudu',
        region: 'us-central1',
        publicAgentUrl: 'https://adkclaw-abc.run.app',
        evidence: 'Deployed at 14:32 UTC',
      }).success,
    ).toBe(true);
  });

  it('rejects level > 4', () => {
    expect(badgeSchema.safeParse({ level: 5 }).success).toBe(false);
  });

  it('rejects level < 0', () => {
    expect(badgeSchema.safeParse({ level: -1 }).success).toBe(false);
  });

  it('rejects non-URL publicAgentUrl', () => {
    expect(badgeSchema.safeParse({ level: 4, publicAgentUrl: 'not-a-url' }).success).toBe(false);
  });

  it('rejects evidence > 500 chars', () => {
    expect(badgeSchema.safeParse({ level: 1, evidence: 'x'.repeat(501) }).success).toBe(false);
  });
});
