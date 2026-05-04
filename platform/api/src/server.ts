/**
 * Express server — assembles routes, middleware, error handling.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { eventsRouter } from './routes/events.js';
import { buildersRouter } from './routes/builders.js';
import { regionsRouter } from './routes/regions.js';
import { logger } from './lib/logger.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy (Cloud Run sets X-Forwarded-* headers)
  app.set('trust proxy', 1);

  // Body parser
  app.use(express.json({ limit: '64kb' }));

  // CORS
  const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',');
  app.use(
    cors({
      origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
      credentials: false,
    }),
  );

  // Rate limit on everything except health
  const rateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req: Request) => req.path === '/api/health',
  });
  app.use(rateLimiter);

  // Request log
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, path: req.path, ip: req.ip }, 'request');
    next();
  });

  // Health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'adkclaw-api', version: '0.1.0' });
  });

  // Routes
  app.use('/api', eventsRouter);
  app.use('/api', buildersRouter);
  app.use('/api', regionsRouter);

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack }, 'unhandled error');
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
