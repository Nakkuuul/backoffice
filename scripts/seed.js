import { pool } from '../src/db/pool.js';
import { logger } from '../src/shared/utils/logger.js';

/**
 * Idempotent seed script for reference/dev data.
 * Add INSERT ... ON CONFLICT DO NOTHING statements below.
 *
 *   npm run seed
 */
async function seed() {
  // Example:
  // await pool.query(`INSERT INTO roles (name) VALUES ('admin') ON CONFLICT DO NOTHING`);
  logger.info('Seeding complete (no seeders defined yet)');
}

try {
  await seed();
} catch (err) {
  logger.error({ err }, 'Seeding failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
