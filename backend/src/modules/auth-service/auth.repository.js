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

/* ── Password-reset credentials (only SHA-256 hashes stored) ──────────────────── */

export async function createResetToken({ userId, tokenHash, kind, channel, expiresAt, ip }) {
  const { rows } = await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, kind, channel, expires_at, requested_ip)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, tokenHash, kind, channel, expiresAt, ip ?? null],
  );
  return rows[0];
}

/** How many reset requests this user made within the window (throttle). */
export async function countRecentResetRequests(userId, sinceMs) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM password_reset_tokens
       WHERE user_id = $1 AND created_at > now() - ($2::int * interval '1 millisecond')`,
    [userId, sinceMs],
  );
  return rows[0].n;
}

/** Invalidate every outstanding (unused) reset token for a user. */
export async function invalidateUserResetTokens(userId) {
  await query(
    `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
}

/**
 * Atomically claim a LINK token by its hash: marks it used and returns the row
 * only if it was unused and unexpired. Concurrent replays get 0 rows → null.
 */
export async function claimLinkToken(tokenHash) {
  const { rows } = await query(
    `UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = $1 AND kind = 'link' AND used_at IS NULL AND expires_at > now()
       RETURNING *`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

/** Inspect (without consuming) a link token's validity. */
export async function findValidLinkToken(tokenHash) {
  const { rows } = await query(
    `SELECT id FROM password_reset_tokens
       WHERE token_hash = $1 AND kind = 'link' AND used_at IS NULL AND expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

/** The newest active OTP row for a user (unused + unexpired). */
export async function findActiveOtp(userId) {
  const { rows } = await query(
    `SELECT * FROM password_reset_tokens
       WHERE user_id = $1 AND kind = 'otp' AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** Atomically consume a specific reset row (link or otp) by id. */
export async function consumeResetToken(id) {
  const { rows } = await query(
    `UPDATE password_reset_tokens SET used_at = now()
       WHERE id = $1 AND used_at IS NULL RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

/**
 * Record a wrong-OTP attempt; lock (consume) the row once the cap is hit. The
 * `used_at IS NULL` guard makes concurrent bumps serialize correctly — once a
 * bump locks the row, further bumps no-op (counter can't run past the cap).
 */
export async function bumpOtpAttempt(id, maxAttempts) {
  const { rows } = await query(
    `UPDATE password_reset_tokens
       SET attempts = attempts + 1,
           used_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE used_at END
       WHERE id = $1 AND used_at IS NULL RETURNING attempts, used_at`,
    [id, maxAttempts],
  );
  return rows[0] ?? null;
}

export async function countRecoveryCodes(userId) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM auth_recovery_codes WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
  return rows[0].n;
}
