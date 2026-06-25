import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, withTransaction } from '../src/db/pool.js';
import { logger } from '../src/shared/utils/logger.js';

/**
 * Minimal forward-only SQL migration runner (no external dependency).
 * Migrations live in src/db/migrations as `NNN_name.sql` and run in order.
 * Applied migrations are tracked in the `schema_migrations` table.
 *
 *   npm run migrate          # apply all pending
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedSet() {
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

async function up() {
  await ensureTable();
  const applied = await appliedSet();
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    logger.info('No pending migrations');
    return;
  }

  for (const file of pending) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    logger.info(`Applied migration: ${file}`);
  }
}

const command = process.argv[2] || 'up';

try {
  if (command === 'up') {
    await up();
  } else {
    logger.error(`Unknown command: ${command}. Supported: up`);
    process.exitCode = 1;
  }
} catch (err) {
  logger.error({ err }, 'Migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
