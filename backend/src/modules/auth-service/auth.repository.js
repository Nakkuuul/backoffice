import crypto from 'node:crypto';
import { query } from '../../db/pool.js';

/**
 * Refresh-token sessions. The raw refresh token is never stored — only its
 * SHA-256 — so a DB leak can't be used to mint access tokens.
 */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession({ userId, refreshToken, expiresAt, userAgent, ip }) {
  const { rows } = await query(
    `INSERT INTO auth_sessions (user_id, refresh_hash, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [userId, hashToken(refreshToken), expiresAt, userAgent ?? null, ip ?? null],
  );
  return rows[0];
}

/**
 * Atomically consume a refresh token: revoke it and return the session in a
 * single statement. Concurrent replays of the same token find revoked_at
 * already set → 0 rows → null, so a token can be redeemed exactly once
 * (replay-safe rotation).
 */
export async function claimSession(refreshToken) {
  const { rows } = await query(
    `UPDATE auth_sessions SET revoked_at = now(), last_used_at = now()
       WHERE refresh_hash = $1 AND revoked_at IS NULL AND expires_at > now()
       RETURNING *`,
    [hashToken(refreshToken)],
  );
  return rows[0] ?? null;
}

export async function revokeSession(refreshToken) {
  await query(
    `UPDATE auth_sessions SET revoked_at = now() WHERE refresh_hash = $1 AND revoked_at IS NULL`,
    [hashToken(refreshToken)],
  );
}

export async function revokeAllForUser(userId) {
  await query(
    `UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
