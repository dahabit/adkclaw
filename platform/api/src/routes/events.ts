/**
 * Event routes — instructor creates events, public reads event metadata.
 *
 *   POST /events                    Create a new event (instructor token required)
 *   GET  /events/:code              Public event metadata (registered count, etc.)
 *   GET  /events/:code/builders     Fleet snapshot for the 3D globe / grid view
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { collections } from '../lib/firestore.js';
import { createEventSchema } from '../lib/validate.js';
import { logger } from '../lib/logger.js';
import type { Event, FleetSnapshot, LevelId } from '../types/index.js';

export const eventsRouter = Router();

eventsRouter.post(
  '/events',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createEventSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
        return;
      }

      if (parsed.data.instructorToken !== process.env.INSTRUCTOR_TOKEN) {
        res.status(401).json({ error: 'invalid_instructor_token' });
        return;
      }

      const existing = await collections.events.doc(parsed.data.code).get();
      if (existing.exists) {
        res.status(409).json({ error: 'event_code_taken' });
        return;
      }

      const event: Event = {
        code: parsed.data.code,
        name: parsed.data.name,
        status: 'open',
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        capacity: parsed.data.capacity,
        isPublic: parsed.data.isPublic ?? false,
        createdAt: new Date().toISOString(),
        createdBy: 'instructor',
      };

      await collections.events.doc(event.code).set(event);

      logger.info({ eventCode: event.code }, 'Event created');

      res.status(201).json({
        code: event.code,
        joinUrl: `https://adkclaw.dev/join/${event.code}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

eventsRouter.get(
  '/events/:code',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = req.params.code ?? '';
      const doc = await collections.events.doc(code).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'event_not_found' });
        return;
      }

      const event = doc.data() as Event;
      const buildersSnapshot = await collections.builders
        .where('eventCode', '==', code)
        .count()
        .get();
      const registeredCount = buildersSnapshot.data().count;

      res.json({
        code: event.code,
        name: event.name,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        capacity: event.capacity,
        registeredCount,
      });
    } catch (err) {
      next(err);
    }
  },
);

eventsRouter.get(
  '/events/:code/builders',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = req.params.code ?? '';
      const buildersSnapshot = await collections.builders
        .where('eventCode', '==', code)
        .limit(1000)
        .get();

      const builders: FleetSnapshot['builders'] = [];
      let deployed = 0;

      for (const builderDoc of buildersSnapshot.docs) {
        const data = builderDoc.data();

        // Fetch level completions for this builder
        const completionsSnapshot = await collections.levelCompletions
          .where('username', '==', data.username)
          .get();

        const levels = completionsSnapshot.docs
          .map((d) => d.data().level as LevelId)
          .sort((a, b) => a - b);

        if (data.status === 'deployed') deployed += 1;

        builders.push({
          username: data.username,
          avatarPreset: data.avatarPreset,
          status: data.status,
          region: data.region,
          agentName: data.agentName,
          publicAgentUrl: data.publicAgentUrl,
          levels,
        });
      }

      const snapshot: FleetSnapshot = {
        builders,
        total: builders.length,
        deployed,
      };

      // Public event data — cache briefly
      res.set('Cache-Control', 'public, max-age=5');
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  },
);
