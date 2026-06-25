import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../shared/utils/logger.js';

const { Pool } = pg;

/**
 * Single shared PostgreSQL connection pool for the whole process.
 * Import `query` / `getClient` from here — do not create pools elsewhere.
 */
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: config.db.max,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/** Run a parameterized query against the pool. */
export const query = (text, params) => pool.query(text, params);

/** Acquire a dedicated client (for transactions). Remember to release it. */
export const getClient = () => pool.connect();

/**
 * Run a function inside a transaction, committing on success and rolling
 * back on any thrown error.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
