/**
 * Verify user-service auth + RBAC: create users of different roles, log in,
 * and assert permission resolution. node scripts/test-users.mjs
 */
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { register as createUser, login, me } from '../src/modules/auth-service/auth.service.js';
import { hasPermission, effectivePermissions, ALL_PERMISSIONS } from '../src/shared/rbac.js';

const ts = Date.now();
const pw = 'password123';
const emails = {
  sup: `sup${ts}@test.local`,
  ops: `ops${ts}@test.local`,
  cli: `cli${ts}@test.local`,
};

try {
  await createUser({ email: emails.sup, password: pw, role: 'super_admin', fullName: 'Super' });
  const ops = await createUser({ email: emails.ops, password: pw, role: 'operations', fullName: 'Ops' });
  await createUser({ email: emails.cli, password: pw, role: 'client', clientRef: 'CL0001', fullName: 'Client' });

  // Permissions resolve from role (independent of the multi-step login).
  const supPerms = effectivePermissions('super_admin');
  console.log('super_admin perms:', supPerms.length, '(all =', ALL_PERMISSIONS.length, ')');
  console.log('operations perms :', effectivePermissions('operations').length);
  console.log('client perms     :', effectivePermissions('client'));

  // Newly-created users are forced through password change first → login returns
  // a challenge, not full tokens.
  const opsLogin = await login({ email: emails.ops, password: pw });
  assert.equal(opsLogin.stage, 'change_password', 'first login → change_password challenge');

  // Wrong password rejected (before any staging).
  let badRejected = false;
  try { await login({ email: emails.ops, password: 'nope' }); } catch { badRejected = true; }

  // me()
  const meOps = await me(ops.id);

  // ── Assertions ──────────────────────────────────────────────────────────
  assert.equal(supPerms.length, ALL_PERMISSIONS.length, 'super_admin = all permissions');
  assert.ok(hasPermission('super_admin', 'anything:whatever'), 'super_admin wildcard');
  assert.ok(hasPermission('operations', 'reports:generate'), 'ops can generate reports');
  assert.ok(!hasPermission('operations', 'users:manage'), 'ops cannot manage users');
  assert.ok(hasPermission('admin', 'reports:bulk'), 'admin reports:* wildcard expands');
  assert.ok(!hasPermission('admin', 'esign:config'), 'esign:config reserved to super_admin');
  assert.ok(hasPermission('client', 'self:reports:read'), 'client sees own reports');
  assert.ok(!hasPermission('client', 'reports:generate'), 'client cannot generate reports');
  assert.equal(meOps.user.role, 'operations');
  assert.ok(badRejected, 'wrong password rejected');
  assert.ok(effectivePermissions('client').length === 3, 'client has exactly 3 perms');

  console.log('\n✅ USER-SERVICE RBAC OK');
} catch (err) {
  console.error('\n❌', err.message);
  process.exitCode = 1;
} finally {
  // cleanup test users
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`%${ts}@test.local`]);
  await pool.end();
}
