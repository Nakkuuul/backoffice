/**
 * Verify the "forgot access" / password-reset flow end-to-end at the service
 * level (reading the durable outbox for the real link/OTP), covering both
 * channels, single-use, attempt-lock, and enumeration-safety.
 *   node scripts/test-password-reset.mjs
 */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';
import * as auth from '../src/modules/auth-service/auth.service.js';
import * as users from '../src/modules/user-service/user.repository.js';

const ts = Date.now();
const email = `reset${ts}@example.com`;

const latestBody = async () => {
  const { rows } = await pool.query(`SELECT body_text FROM email_messages ORDER BY id DESC LIMIT 1`);
  return rows[0]?.body_text ?? '';
};
const activeTokenCount = async (userId) =>
  (await pool.query(`SELECT count(*)::int n FROM password_reset_tokens WHERE user_id=$1 AND used_at IS NULL`, [userId]))
    .rows[0].n;

try {
  const u = await auth.register({ email, password: 'TempPass#9', fullName: 'Reset Tester', role: 'operations' });
  const userId = u.id;

  // ── A. Email reset link ─────────────────────────────────────────────────────
  await auth.requestPasswordReset({ email, method: 'email_link' }, {}, { await: true });
  const token = (await latestBody()).match(/token=([A-Za-z0-9\-_]+)/)?.[1];
  assert.ok(token, 'reset link token present in email');
  assert.deepEqual(await auth.verifyResetToken({ token }), { valid: true }, 'link valid before use');
  await auth.resetPassword({ token, newPassword: 'LinkPass#123' });
  let full = await users.findFullById(userId);
  assert.ok(await bcrypt.compare('LinkPass#123', full.password_hash), 'password set via link');
  assert.equal(full.must_change_password, false, 'must_change_password cleared');
  let replayed = false;
  try {
    await auth.resetPassword({ token, newPassword: 'Other#9999' });
  } catch {
    replayed = true;
  }
  assert.ok(replayed, 'link token is single-use');
  assert.deepEqual(await auth.verifyResetToken({ token }), { valid: false }, 'link invalid after use');
  console.log('email-link OK (issue → verify → reset → single-use)');

  // ── B. Email OTP + wrong-code rejection ─────────────────────────────────────
  await auth.requestPasswordReset({ email, method: 'email_otp' }, {}, { await: true });
  const otp = (await latestBody()).match(/code is (\d{6})/)?.[1];
  assert.ok(otp, 'otp present in email');
  let wrongRejected = false;
  try {
    await auth.resetPassword({ email, otp: '000000', newPassword: 'Nope#123' });
  } catch {
    wrongRejected = true;
  }
  assert.ok(wrongRejected, 'wrong OTP rejected');
  await auth.resetPassword({ email, otp, newPassword: 'OtpPass#456' });
  full = await users.findFullById(userId);
  assert.ok(await bcrypt.compare('OtpPass#456', full.password_hash), 'password set via OTP');
  console.log('email-otp OK (issue → wrong-code rejected → reset)');

  // ── C. Enumeration-safe: unknown account ────────────────────────────────────
  assert.deepEqual(
    await auth.requestPasswordReset({ email: `ghost${ts}@example.com`, method: 'email_link' }, {}, { await: true }),
    { ok: true },
    'unknown email → uniform ok (no throw / disclosure)',
  );

  // ── D. OTP attempt lock ─────────────────────────────────────────────────────
  await auth.requestPasswordReset({ email, method: 'email_otp' }, {}, { await: true });
  const liveOtp = (await latestBody()).match(/code is (\d{6})/)?.[1];
  for (let i = 0; i < 5; i++) {
    await auth.resetPassword({ email, otp: '111111', newPassword: 'X#1' }).catch(() => {});
  }
  let lockedOut = false;
  try {
    await auth.resetPassword({ email, otp: liveOtp, newPassword: 'X#2' });
  } catch {
    lockedOut = true;
  }
  assert.ok(lockedOut, 'OTP locked after max wrong attempts (even the correct code fails)');
  console.log('otp attempt-lock OK');

  // ── E. SMS OTP with no phone → silent no-op ─────────────────────────────────
  const before = await activeTokenCount(userId);
  await auth.requestPasswordReset({ email, method: 'sms_otp' }, {}, { await: true });
  assert.equal(await activeTokenCount(userId), before, 'sms_otp with no phone → no token issued');
  console.log('sms-otp no-phone no-op OK');

  // ── F. Reset reuse guard ────────────────────────────────────────────────────
  await auth.requestPasswordReset({ email, method: 'email_link' }, {}, { await: true });
  const t2 = (await latestBody()).match(/token=([A-Za-z0-9\-_]+)/)?.[1];
  let reuseRejected = false;
  try {
    await auth.resetPassword({ token: t2, newPassword: 'OtpPass#456' }); // same as current
  } catch {
    reuseRejected = true;
  }
  assert.ok(reuseRejected, 'cannot reset to the current password');
  console.log('reuse-guard OK');

  // ── G. An active password change invalidates pending reset tokens (review fix) ──
  await auth.requestPasswordReset({ email, method: 'email_link' }, {}, { await: true });
  const t3 = (await latestBody()).match(/token=([A-Za-z0-9\-_]+)/)?.[1];
  assert.ok(t3, 'fresh link issued');
  await auth.changePassword(userId, { currentPassword: 'OtpPass#456', newPassword: 'Changed#789' });
  assert.deepEqual(
    await auth.verifyResetToken({ token: t3 }),
    { valid: false },
    'change-password invalidates outstanding reset tokens',
  );
  console.log('change-password invalidates reset tokens OK');

  console.log('\n✅ PASSWORD-RESET OK (link + otp · single-use · attempt-lock · enumeration-safe · reuse-guard)');
} catch (err) {
  console.error('\n❌', err.stack || err.message);
  process.exitCode = 1;
} finally {
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await pool.end();
}
