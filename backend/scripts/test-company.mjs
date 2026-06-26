/**
 * Verify company-service: seeded singleton profile + memberships, profile update,
 * and membership add/update/remove. node scripts/test-company.mjs
 */
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import * as company from '../src/modules/company-service/company.service.js';

try {
  await company.ensureCompany(); // idempotent

  const c1 = await company.getCompany();
  assert.equal(c1.profile.tradeName, 'Sapphire Broking', 'seeded trade name');
  assert.ok(c1.memberships.length >= 2, 'seeded NSE + BSE memberships');
  assert.ok(c1.activeSegments.includes('CASH') && c1.activeSegments.includes('FNO'), 'derived active segments');
  console.log(`profile + ${c1.memberships.length} memberships; segments: ${c1.activeSegments.join(', ')}`);

  // Update profile (partial).
  const u = await company.updateCompany(
    { phone: '+91-712-2999999', cin: 'U67120MH2019PTC000000', registeredAddress: { city: 'Nagpur', state: 'Maharashtra', country: 'India' } },
    { updatedBy: null },
  );
  assert.equal(u.phone, '+91-712-2999999');
  assert.equal(u.cin, 'U67120MH2019PTC000000');
  assert.equal(u.registeredAddress.city, 'Nagpur', 'jsonb address stored');
  console.log('profile update OK (scalar + jsonb)');

  // Add a membership.
  const m = await company.addMembership({ exchange: 'MCX', membershipType: 'TM', segments: ['COMMODITY'], active: true });
  assert.equal(m.exchange, 'MCX');
  assert.deepEqual(m.segments, ['COMMODITY'], 'text[] segments stored');

  // Update it.
  const m2 = await company.updateMembership(m.id, { active: false, segments: ['COMMODITY', 'CURRENCY'] });
  assert.equal(m2.active, false);
  assert.deepEqual(m2.segments, ['COMMODITY', 'CURRENCY']);
  console.log('membership add + update OK');

  // Remove it; second update should 404.
  await company.removeMembership(m.id);
  let gone = false;
  try {
    await company.updateMembership(m.id, { active: true });
  } catch {
    gone = true;
  }
  assert.ok(gone, 'removed membership not found');
  console.log('membership remove OK');

  console.log('\n✅ COMPANY-SERVICE OK (singleton profile + structured memberships)');
} catch (err) {
  console.error('\n❌', err.stack || err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
