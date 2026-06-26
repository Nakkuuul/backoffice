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
    {
      phone: '+91-712-2999999',
      cin: 'U67120MH2019PTC000000',
      registeredAddress: { city: 'Nagpur', state: 'Maharashtra', country: 'India' },
      depositories: [
        { depository: 'NSDL', mode: 'self', dpId: 'IN303456', active: true },
        { depository: 'CDSL', mode: 'third_party', dpId: '12088700', active: true, thirdParty: { name: 'Globe Capital DP', dpId: '12088700', email: 'dp@globe.example' } },
      ],
    },
    { updatedBy: null },
  );
  assert.equal(u.phone, '+91-712-2999999');
  assert.equal(u.registeredAddress.city, 'Nagpur', 'jsonb address stored');
  assert.equal(u.depositories.length, 2, 'depositories stored');
  assert.equal(u.depositories[0].mode, 'self');
  assert.equal(u.depositories[1].thirdParty.name, 'Globe Capital DP', 'third-party DP info stored');
  const cc = await company.getCompany();
  assert.equal(cc.dpMode, 'mixed', 'derived dpMode (self + third_party)');
  console.log('profile update OK (scalar + jsonb + depositories; dpMode=mixed)');

  // Add a membership with third-party clearing.
  const m = await company.addMembership({
    exchange: 'MCX',
    membershipType: 'TM',
    clearingMode: 'third_party',
    segments: ['COMMODITY'],
    active: true,
    thirdPartyClearer: { name: 'Phillip Commodities', cmCode: 'MCX-CM-118', sebiRegNo: 'INZ000045678' },
  });
  assert.equal(m.exchange, 'MCX');
  assert.equal(m.clearingMode, 'third_party');
  assert.equal(m.thirdPartyClearer.name, 'Phillip Commodities', 'third-party clearer stored');
  assert.deepEqual(m.segments, ['COMMODITY'], 'text[] segments stored');

  // Update it (switch to self-clearing).
  const m2 = await company.updateMembership(m.id, { clearingMode: 'self', active: false, segments: ['COMMODITY', 'CURRENCY'] });
  assert.equal(m2.active, false);
  assert.equal(m2.clearingMode, 'self');
  assert.deepEqual(m2.segments, ['COMMODITY', 'CURRENCY']);
  console.log('membership add + update OK (clearing mode + third-party clearer)');

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
