/**
 * Regions route — returns Cloud Run regions for the 3D globe (Phase 3).
 *
 *   GET /regions   List all regions with lat/lng for the globe
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { collections } from '../lib/firestore.js';
import type { Region } from '../types/index.js';

export const regionsRouter = Router();

regionsRouter.get(
  '/regions',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const snapshot = await collections.regions.get();
      const regions: Region[] = snapshot.docs.map((d) => d.data() as Region);
      res.set('Cache-Control', 'public, max-age=3600');
      res.json({ regions });
    } catch (err) {
      next(err);
    }
  },
);
