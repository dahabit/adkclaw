/**
 * AdkClaw API entrypoint.
 */

import 'dotenv/config';
import { createApp } from './server.js';
import { logger } from './lib/logger.js';

const app = createApp();
const port = parseInt(process.env.PORT || '8080', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  logger.info({ port, host, env: process.env.NODE_ENV }, 'AdkClaw API listening');
});
