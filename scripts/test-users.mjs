/**
 * Verify user-service auth + RBAC: create users of different roles, log in,
 * and assert permission resolution. node scripts/test-users.mjs
 */
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { createUser, login, me } from '../src/modules/user-service/user.service.js';
import {
  hasPermission,
  effectivePermissions,
  ALL_PERMISSIONS,
} from '../src/modules/user-service/rbac.js';

const ts = Date.now();
const pw = 'password123';
const emails = {
  sup: `sup${ts}@test.local`,
  ops: `ops${ts}@test.local`,
  cli: `cli${ts}@test.local`,
};

try {
  await createUser({ email: emails.sup, password: pw, role: 'super_admin', fullName: 'Super' });
  await createUser({ email: emails.ops, password: pw, role: 'operations', fullName: 'Ops' });
  await createUser({ email: emails.cli, password: pw, role: 'client', clientRef: 'CL0001', fullName: 'Client' });

  // Login flow
  const sup = await login({ email: emails.sup, password: pw });
  const ops = await login({ email: emails.ops, password: pw });
  const cli = await login({ email: emails.cli, password: pw });
  console.log('super_admin perms:', sup.permissions.length, '(all =', ALL_PERMISSIONS.length, ')');
  console.log('operations perms :', ops.permissions.length);
  console.log('client perms     :', cli.permissions);

  // Wrong password rejected
  let badRejected = false;
  try { await login({ email: emails.ops, password: 'nope' }); } catch { badRejected = true; }

  // me()
  const meOps = await me(ops.user.id);

  // ── Assertions ──────────────────────────────────────────────────────────
  assert.equal(sup.permissions.length, ALL_PERMISSIONS.length, 'super_admin = all permissions');
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
