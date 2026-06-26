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

/* ── 2FA recovery codes (only SHA-256 hashes stored) ──────────────────────── */

/** Replace a user's recovery codes with a fresh batch (hashes). */
export async function replaceRecoveryCodes(userId, codeHashes) {
  await query(`DELETE FROM auth_recovery_codes WHERE user_id = $1`, [userId]);
  for (const hash of codeHashes) {
    await query(`INSERT INTO auth_recovery_codes (user_id, code_hash) VALUES ($1,$2)`, [
      userId,
      hash,
    ]);
  }
}

/** Atomically consume one unused recovery code; returns true if it was valid. */
export async function consumeRecoveryCode(userId, codeHash) {
  const { rows } = await query(
    `UPDATE auth_recovery_codes SET used_at = now()
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       RETURNING id`,
    [userId, codeHash],
  );
  return rows.length > 0;
}

export async function deleteRecoveryCodes(userId) {
  await query(`DELETE FROM auth_recovery_codes WHERE user_id = $1`, [userId]);
}

export async function countRecoveryCodes(userId) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM auth_recovery_codes WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
  return rows[0].n;
}
