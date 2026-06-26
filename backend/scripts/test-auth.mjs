/**
 * Verify auth-service security flows (service level):
 *   register → login (mcp) → refresh rotation → change-password (clears mcp,
 *   revokes sessions, new tokens) → logout revocation; + master idempotency.
 *   node scripts/test-auth.mjs
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config/index.js';
import * as auth from '../src/modules/auth-service/auth.service.js';

const ts = Date.now();
const email = `auth${ts}@test.local`;
const pw0 = 'TempPass#1';
const pw1 = 'NewPass#12345';
const decode = (t) => jwt.verify(t, config.auth.jwtSecret);

try {
  // Master bootstrap is idempotent (a super_admin already exists in dev).
  assert.equal((await auth.ensureMaster()).created, false, 'ensureMaster idempotent');

  // Register → forced password change on first login.
  const u = await auth.register({ email, password: pw0, fullName: 'Auth Test', role: 'operations' });
  assert.equal(u.mustChangePassword, true, 'registered user must change password');

  // Login → access + refresh; mcp claim true.
  const l = await auth.login({ email, password: pw0 });
  assert.ok(l.token && l.refreshToken, 'login returns access + refresh');
  assert.equal(l.mustChangePassword, true);
  assert.equal(decode(l.token).mcp, true, 'access token carries mcp=true');
  console.log('login → access+refresh issued, mcp=true');

  // Wrong password rejected.
  let wrong = false;
  try { await auth.login({ email, password: 'nope' }); } catch { wrong = true; }
  assert.ok(wrong, 'wrong password rejected');

  // Refresh rotation: new pair; the old refresh is now revoked.
  const r = await auth.refresh({ refreshToken: l.refreshToken });
  assert.ok(r.refreshToken && r.refreshToken !== l.refreshToken, 'refresh rotates the token');
  let oldFails = false;
  try { await auth.refresh({ refreshToken: l.refreshToken }); } catch { oldFails = true; }
  assert.ok(oldFails, 'rotated-out refresh token is revoked');
  console.log('refresh → rotated; old refresh revoked');

  // Change password: clears mcp, returns fresh tokens (mcp=false), revokes ALL sessions.
  const cp = await auth.changePassword(u.id, { currentPassword: pw0, newPassword: pw1 });
  assert.equal(cp.mustChangePassword, false, 'mcp cleared after change');
  assert.equal(decode(cp.token).mcp, false, 'fresh token has mcp=false');
  let rRevoked = false;
  try { await auth.refresh({ refreshToken: r.refreshToken }); } catch { rRevoked = true; }
  assert.ok(rRevoked, 'all prior sessions revoked on password change');
  console.log('change-password → mcp cleared, prior sessions revoked, fresh tokens issued');

  // New password works (mcp false); logout revokes the session.
  const l2 = await auth.login({ email, password: pw1 });
  assert.equal(l2.mustChangePassword, false);
  await auth.logout(l2.user.id, { refreshToken: l2.refreshToken });
  let loggedOut = false;
  try { await auth.refresh({ refreshToken: l2.refreshToken }); } catch { loggedOut = true; }
  assert.ok(loggedOut, 'logout revokes the refresh session');
  console.log('logout → session revoked');

  console.log('\n✅ AUTH-SERVICE OK (access+refresh, rotation, forced-change, revocation)');
} catch (err) {
  console.error('\n❌', err.message);
  process.exitCode = 1;
} finally {
  await pool.query(`DELETE FROM users WHERE email = $1`, [email]); // cascades auth_sessions
  await pool.end();
}
