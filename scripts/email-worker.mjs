/**
 * Standalone email outbox worker process.
 *   node scripts/email-worker.mjs   (or: npm run email:worker)
 *
 * Run MANY of these across machines/containers to scale send throughput toward
 * the 100M/6h target — each instance gets a unique id and SKIP LOCKED ensures no
 * two workers ever claim the same message. The API process can run with
 * EMAIL_WORKER_ENABLED=false so capacity scales independently of the API.
 */
import { logger } from '../src/shared/utils/logger.js';
import { pool } from '../src/db/pool.js';
import { EmailWorker } from '../src/modules/email-service/email.worker.js';

const worker = new EmailWorker();
worker.start();
logger.info('email-worker process started');

const shutdown = async (sig) => {
  logger.info(`email-worker received ${sig}, draining...`);
  await worker.stop();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
