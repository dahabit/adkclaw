/**
 * Zod schemas for request validation. All API request bodies run through
 * these before touching business logic.
 */

import { z } from 'zod';

const AVATAR_PRESETS = [
  'chrome',
  'bronze',
  'slate',
  'cosmic',
  'nova',
  'onyx',
  'pine',
  'ember',
  'mint',
  'coral',
  'sky',
  'gold',
  'lavender',
  'forest',
  'sunset',
  'arctic',
] as const;

const usernameSchema = z
  .string()
  .min(2)
  .max(20)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username may contain letters, numbers, underscores, and hyphens only',
  );

const eventCodeSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Event code must be lowercase alphanumeric with hyphens');

export const createEventSchema = z.object({
  code: eventCodeSchema,
  name: z.string().min(2).max(120),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().positive().max(10000),
  isPublic: z.boolean().optional().default(false),
  instructorToken: z.string().min(8),
});

export const registerBuilderSchema = z.object({
  eventCode: eventCodeSchema,
  username: usernameSchema,
  avatarPreset: z.enum(AVATAR_PRESETS),
});

export const badgeSchema = z.object({
  level: z.number().int().min(0).max(4),
  agentName: z.string().min(1).max(40).optional(),
  region: z.string().max(40).optional(),
  publicAgentUrl: z.string().url().max(200).optional(),
  evidence: z.string().max(500).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RegisterBuilderInput = z.infer<typeof registerBuilderSchema>;
export type BadgeInput = z.infer<typeof badgeSchema>;
