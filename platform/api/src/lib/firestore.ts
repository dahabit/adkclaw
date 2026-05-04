/**
 * Firestore client + collection references.
 *
 * Local dev: connects to Firestore emulator if FIRESTORE_EMULATOR_HOST is set
 * (typically localhost:8085).
 *
 * Production: uses application-default credentials in Cloud Run.
 */

import { Firestore } from '@google-cloud/firestore';
import { logger } from './logger.js';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'adkclaw-dev-local';

if (process.env.FIRESTORE_EMULATOR_HOST) {
  logger.info({ host: process.env.FIRESTORE_EMULATOR_HOST }, 'Using Firestore emulator');
}

export const firestore = new Firestore({
  projectId,
  ignoreUndefinedProperties: true,
});

export const collections = {
  events: firestore.collection('events'),
  builders: firestore.collection('builders'),
  levelCompletions: firestore.collection('level_completions'),
  regions: firestore.collection('regions'),
};
