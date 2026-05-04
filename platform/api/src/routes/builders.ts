/**
 * Builder routes — register, public profile, badge POST (HMAC-signed).
 *
 *   POST /builders                          Register a new builder
 *   GET  /builders/:username                Public profile + level completions
 *   POST /builders/:username/badge          Agent self-reports completion (HMAC)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { collections } from '../lib/firestore.js';
import { registerBuilderSchema, badgeSchema } from '../lib/validate.js';
import { generateBuilderSecret, hashSecret, verifySecret, verifySignature } from '../lib/auth.js';
import { logger } from '../lib/logger.js';
import type { Builder, BuilderProfile, LevelCompletion, LevelId } from '../types/index.js';

export const buildersRouter = Router();

interface BuilderDocument extends Builder {
  hmacSecretHash: string;
}

buildersRouter.post(
  '/builders',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = registerBuilderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
        return;
      }

      // Verify event exists and is open
      const eventDoc = await collections.events.doc(parsed.data.eventCode).get();
      if (!eventDoc.exists) {
        res.status(404).json({ error: 'event_not_found' });
        return;
      }
      const event = eventDoc.data();
      if (event?.status !== 'open') {
        res.status(409).json({ error: 'event_closed' });
        return;
      }

      // Check capacity
      const countSnapshot = await collections.builders
        .where('eventCode', '==', parsed.data.eventCode)
        .count()
        .get();
      if (countSnapshot.data().count >= event.capacity) {
        res.status(409).json({ error: 'event_at_capacity' });
        return;
      }

      // Check username availability across all events (usernames are global)
      const existing = await collections.builders.doc(parsed.data.username).get();
      if (existing.exists) {
        res.status(409).json({ error: 'username_taken' });
        return;
      }

      // Generate the secret, hash it
      const secret = generateBuilderSecret();
      const hash = await hashSecret(secret);

      const builder: BuilderDocument = {
        username: parsed.data.username,
        eventCode: parsed.data.eventCode,
        avatarPreset: parsed.data.avatarPreset,
        agentName: null,
        region: null,
        publicAgentUrl: null,
        publicTelegramHandle: null,
        status: 'idle',
        registeredAt: new Date().toISOString(),
        hmacSecretHash: hash,
      };

      await collections.builders.doc(builder.username).set(builder);

      logger.info(
        { username: builder.username, eventCode: builder.eventCode },
        'Builder registered',
      );

      res.status(201).json({
        username: builder.username,
        publicProfileUrl: `https://adkclaw.dev/u/${builder.username}`,
        hmacSecret: secret,
        instructions:
          'Set BUILDER_SECRET and BUILDER_USERNAME in your .env. Your agent will sign badge POSTs with HMAC. ' +
          'This secret will NEVER be shown again — save it now.',
      });
    } catch (err) {
      next(err);
    }
  },
);

buildersRouter.get(
  '/builders/:username',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const username = req.params.username ?? '';
      const doc = await collections.builders.doc(username).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'builder_not_found' });
        return;
      }

      const data = doc.data() as BuilderDocument;
      // Strip the hash before returning publicly
      const builder: Builder = {
        username: data.username,
        eventCode: data.eventCode,
        avatarPreset: data.avatarPreset,
        agentName: data.agentName,
        region: data.region,
        publicAgentUrl: data.publicAgentUrl,
        publicTelegramHandle: data.publicTelegramHandle,
        status: data.status,
        registeredAt: data.registeredAt,
      };

      // Fetch their level completions (no orderBy — sort in JS to avoid composite index)
      const completionsSnapshot = await collections.levelCompletions
        .where('username', '==', username)
        .get();

      const levels: BuilderProfile['levels'] = {};
      let totalSec = 0;

      const completions = completionsSnapshot.docs
        .map((c) => c.data() as LevelCompletion)
        .sort((a, b) => a.level - b.level);

      for (const completion of completions) {
        levels[completion.level] = {
          completedAt: completion.completedAt,
          durationSec: completion.durationSec,
        };
        totalSec += completion.durationSec;
      }

      const profile: BuilderProfile = {
        ...builder,
        levels,
        totalSec,
      };

      res.set('Cache-Control', 'public, max-age=10');
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
);

buildersRouter.post(
  '/builders/:username/badge',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const username = req.params.username ?? '';
      const parsed = badgeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
        return;
      }

      // Auth headers
      const authHeader = req.header('Authorization') ?? '';
      const builderHeader = req.header('X-Builder') ?? '';
      const timestampHeader = req.header('X-Timestamp') ?? '';

      if (!authHeader.startsWith('HMAC ')) {
        res.status(401).json({ error: 'missing_hmac' });
        return;
      }
      if (builderHeader !== username) {
        res.status(401).json({ error: 'username_mismatch' });
        return;
      }

      const signature = authHeader.slice('HMAC '.length).trim();

      // Look up the builder + their secret hash
      const doc = await collections.builders.doc(username).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'builder_not_found' });
        return;
      }
      const data = doc.data() as BuilderDocument;

      // We can't verify HMAC without the plaintext secret. The pattern:
      // The builder POSTs with their plaintext secret in a separate header,
      // we hash & compare against stored hash, then verify signature.
      const presentedSecret = req.header('X-Builder-Secret') ?? '';
      if (!presentedSecret) {
        res.status(401).json({ error: 'missing_builder_secret' });
        return;
      }
      const secretValid = await verifySecret(presentedSecret, data.hmacSecretHash);
      if (!secretValid) {
        res.status(401).json({ error: 'invalid_secret' });
        return;
      }

      // Now verify the HMAC signature using the plaintext secret
      const sigCheck = verifySignature({
        secret: presentedSecret,
        level: parsed.data.level,
        timestampIso: timestampHeader,
        signature,
      });
      if (!sigCheck.ok) {
        res.status(401).json({ error: 'signature_invalid', reason: sigCheck.reason });
        return;
      }

      // Idempotency: don't double-record the same level
      const existingCompletion = await collections.levelCompletions
        .where('username', '==', username)
        .where('level', '==', parsed.data.level)
        .limit(1)
        .get();

      if (existingCompletion.empty) {
        const completion: LevelCompletion = {
          username,
          level: parsed.data.level as LevelId,
          completedAt: new Date().toISOString(),
          durationSec: Math.floor((Date.now() - Date.parse(data.registeredAt)) / 1000),
          evidence: parsed.data.evidence ?? null,
        };
        await collections.levelCompletions.add(completion);
        logger.info(
          { username, level: completion.level, durationSec: completion.durationSec },
          'Level completion recorded',
        );
      }

      // Update builder fields if provided (agentName, region, publicAgentUrl)
      const updates: Partial<BuilderDocument> = {};
      if (parsed.data.agentName) updates.agentName = parsed.data.agentName;
      if (parsed.data.region) updates.region = parsed.data.region;
      if (parsed.data.publicAgentUrl) updates.publicAgentUrl = parsed.data.publicAgentUrl;

      // Status: 'building' once they have a level, 'deployed' once they have level 4
      if (parsed.data.level === 4) updates.status = 'deployed';
      else if (data.status === 'idle') updates.status = 'building';

      if (Object.keys(updates).length > 0) {
        await collections.builders.doc(username).update(updates);
      }

      // Fetch all levels they've earned
      const allCompletions = await collections.levelCompletions
        .where('username', '==', username)
        .get();
      const badgesEarned: LevelId[] = allCompletions.docs
        .map((d) => d.data().level as LevelId)
        .sort((a, b) => a - b);

      res.json({ ok: true, badgesEarned });
    } catch (err) {
      next(err);
    }
  },
);
