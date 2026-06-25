import { pool } from '../../db/pool.js';

/** Liveness probe — process is up. */
export function liveness(_req, res) {
  res.json({ status: 'ok', uptime: process.uptime() });
}

/** Readiness probe — process can serve traffic (DB reachable). */
export async function readiness(_req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'up' });
  } catch {
    res.status(503).json({ status: 'not_ready', db: 'down' });
  }
}
