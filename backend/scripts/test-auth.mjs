/**
 * Verify the full auth-service flow at the service level:
 *   register → login(change_password) → change-password(enroll_2fa) → 2FA setup
 *   → 2FA enable (full tokens + recovery codes) → refresh rotation → logout
 *   → login(verify_2fa) → 2FA verify → recovery-code login + reuse rejected.
 *   node scripts/test-auth.mjs
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config/index.js';
import * as auth from '../src/modules/auth-service/auth.service.js';

const ts = Date.now();
const email = `auth${ts}@example.com`;
const pw0 = 'TempPass#1';
const pw1 = 'NewPass#12345';
const decode = (t) => jwt.verify(t, config.auth.jwtSecret);

try {
  assert.equal((await auth.ensureMaster()).created, false, 'ensureMaster idempotent');

  // Register → first login forces password change.
  const u = await auth.register({ email, password: pw0, fullName: 'Auth Test', role: 'operations' });
  assert.equal(u.mustChangePassword, true);

  // Login (step 1) → challenge: change_password (interim token, no refresh yet).
  const l = await auth.login({ email, password: pw0 });
  assert.equal(l.stage, 'change_password', 'first login → change_password');
  assert.equal(l.refreshToken, undefined, 'no refresh issued mid-flow');
  assert.equal(decode(l.token).pre, true);
  assert.equal(decode(l.token).mcp, true);
  console.log('login → stage=change_password (interim token)');

  // Change password (in login flow) → advances to 2FA enrollment.
  const cp = await auth.changePassword(u.id, { currentPassword: pw0, newPassword: pw1 }, {}, { fromLoginFlow: true });
  assert.equal(cp.stage, 'enroll_2fa', 'after change → enroll_2fa');
  assert.equal(decode(cp.token).mcp, false);
  assert.equal(cp.refreshToken, undefined);
  console.log('change-password → stage=enroll_2fa');

  // 2FA setup → QR + otpauth + secret.
  const setup = await auth.setupTwoFactor(u.id);
  assert.ok(setup.qrCode.startsWith('data:image/png;base64,'), 'QR is a PNG data URL');
  assert.ok(setup.otpauthUrl.startsWith('otpauth://totp/'), 'otpauth URI');
  assert.ok(setup.secret.length >= 16, 'base32 secret');
  console.log('2fa/setup → QR + otpauth + secret');

  // Enable with a real code → full tokens + recovery codes.
  const enable = await auth.enableTwoFactor(u.id, authenticator.generate(setup.secret));
  assert.equal(enable.stage, 'authenticated', 'enable completes login');
  assert.ok(enable.token && enable.refreshToken, 'full tokens issued');
  assert.equal(decode(enable.token).pre, undefined, 'full token is not interim');
  assert.equal(enable.recoveryCodes.length, config.auth.twoFactor.recoveryCodes, 'recovery codes');
  console.log(`2fa/enable → authenticated, ${enable.recoveryCodes.length} recovery codes`);

  // Refresh rotation on the real session; old token revoked.
  const r = await auth.refresh({ refreshToken: enable.refreshToken });
  assert.ok(r.refreshToken !== enable.refreshToken, 'refresh rotates');
  let oldFails = false;
  try { await auth.refresh({ refreshToken: enable.refreshToken }); } catch { oldFails = true; }
  assert.ok(oldFails, 'rotated-out refresh revoked');

  // Logout revokes the session.
  await auth.logout(u.id, { refreshToken: r.refreshToken });
  let loggedOut = false;
  try { await auth.refresh({ refreshToken: r.refreshToken }); } catch { loggedOut = true; }
  assert.ok(loggedOut, 'logout revokes session');
  console.log('refresh rotation + logout revocation OK');

  // Returning login → verify_2fa challenge.
  const l2 = await auth.login({ email, password: pw1 });
  assert.equal(l2.stage, 'verify_2fa', 'returning login → verify_2fa');
  assert.equal(l2.twoFactorEnrolled, true);

  // Verify with a TOTP code → full tokens.
  const v = await auth.verifyTwoFactor(u.id, authenticator.generate(setup.secret));
  assert.equal(v.stage, 'authenticated');
  assert.ok(v.refreshToken);
  console.log('returning login → verify_2fa → authenticated');

  // Wrong code rejected.
  let bad = false;
  try { await auth.verifyTwoFactor(u.id, '000000'); } catch { bad = true; }
  assert.ok(bad, 'wrong 2FA code rejected');

  // Recovery-code login works once, then is rejected on reuse.
  const rec = enable.recoveryCodes[0];
  const vr = await auth.verifyTwoFactor(u.id, rec);
  assert.equal(vr.stage, 'authenticated', 'recovery code logs in');
  let reuse = false;
  try { await auth.verifyTwoFactor(u.id, rec); } catch { reuse = true; }
  assert.ok(reuse, 'used recovery code rejected');
  console.log('recovery code: single-use OK');

  console.log('\n✅ AUTH-SERVICE OK (password change → 2FA enroll → verify, rotation, recovery codes)');
} catch (err) {
  console.error('\n❌', err.stack || err.message);
  process.exitCode = 1;
} finally {
  await pool.query(`DELETE FROM users WHERE email = $1`, [email]); // cascades sessions + recovery codes
  await pool.end();
}
