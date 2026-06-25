/**
 * Verify the eKYC/reKYC workflow: frontoffice intake → run PAN check → attach a
 * document → approve. Plus a reKYC application. node scripts/test-ekyc.mjs
 */
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import * as svc from '../src/modules/ekyc-service/ekyc.service.js';

const ext = `FO-${Date.now()}`;
let appId;

try {
  // 1) Frontoffice push (intake) — new applicant
  const intake = await svc.intake({
    externalRef: ext,
    fullName: 'Asha Verma',
    email: 'asha@example.com',
    mobile: '9876543210',
    pan: 'ABCPV1234K',
  });
  appId = intake.id;
  console.log('intake:', intake);
  assert.equal(intake.status, 'submitted');

  // idempotency — same externalRef returns the same application
  const dup = await svc.intake({ externalRef: ext, fullName: 'Asha Verma', pan: 'ABCPV1234K' });
  assert.ok(dup.deduped && dup.id === appId, 'intake idempotent on externalRef');

  // 2) Run PAN check (provider) — moves submitted → in_review
  const panCheck = await svc.runCheck(appId, 'pan', {});
  console.log('pan check:', panCheck.status, panCheck.provider);
  assert.equal(panCheck.status, 'verified');
  let app = await svc.getApplication(appId);
  assert.equal(app.status, 'in_review');

  // 3) Attach a document (stored in MinIO)
  const doc = await svc.attachDocument(appId, {
    type: 'pan_card',
    buffer: Buffer.from('%PDF-1.4 fake pan card'),
    contentType: 'application/pdf',
  }, { uploadedBy: null });
  console.log('document:', doc.type, doc.size_bytes, 'bytes');

  // 4) Approve (requires PAN verified — it is)
  const decided = await svc.decide(appId, { decision: 'approve', remarks: 'All good' }, { decidedBy: null });
  console.log('decision:', decided.status);
  assert.equal(decided.status, 'approved');

  // 5) Approval guard: a fresh app without PAN check cannot be approved
  const bare = await svc.intake({ externalRef: `${ext}-2`, fullName: 'No Checks', pan: 'ABCPN9999Z' });
  let blocked = false;
  try { await svc.decide(bare.id, { decision: 'approve' }, {}); } catch { blocked = true; }
  assert.ok(blocked, 'cannot approve without required checks');

  // 6) reKYC — modification of an existing client
  const rekyc = await svc.intake({
    kind: 'rekyc', externalRef: `${ext}-3`, clientRef: 'CL0001',
    fullName: 'Asha Verma', changes: { mobile: '9000000000' },
  });
  console.log('rekyc:', rekyc.status);
  assert.equal(rekyc.status, 'submitted');

  console.log('\n✅ eKYC / reKYC WORKFLOW OK');
} catch (err) {
  console.error('\n❌', err.message);
  process.exitCode = 1;
} finally {
  await pool.query(`DELETE FROM kyc_applications WHERE external_ref LIKE $1`, [`FO-%`]);
  await pool.end();
}
