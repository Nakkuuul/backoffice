/**
 * Full cross-service integration check (run against a live app).
 *   node scripts/test-integration.mjs
 *
 * Exercises: auth/RBAC → reports → storage → documents (compress+lock, incl.
 * doc chaining) → email (enqueue→MTA) → esign wiring, and RBAC denials.
 */
import jwt from 'jsonwebtoken';
import { config } from '../src/config/index.js';
import { pool } from '../src/db/pool.js';

const base = `http://localhost:${config.app.port}/api/v1`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`);
};

// Need a real user id for FK-bound inserts (reports/documents requested_by).
const { rows } = await pool.query(
  `SELECT id FROM users WHERE role='super_admin' ORDER BY id LIMIT 1`,
);
const adminId = rows[0]?.id ?? 1;
const tok = (payload) => jwt.sign(payload, config.auth.jwtSecret, { expiresIn: '5m' });
const admin = tok({ id: Number(adminId), role: 'super_admin', type: 'broker' });
const ops = tok({ id: Number(adminId), role: 'operations', type: 'broker' });
const client = tok({ id: Number(adminId), role: 'client', type: 'client', clientRef: 'CL0001' });

const api = async (method, path, token, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, raw: text };
};

// 1) AUTH — /auth/me resolves identity + permissions
const meR = await api('GET', '/auth/me', admin);
check('user-service: /auth/me', meR.status === 200 && meR.json.permissions?.length > 0,
  `role=${meR.json.user?.role} perms=${meR.json.permissions?.length}`);

// 2) RBAC — roles catalog
const rolesR = await api('GET', '/users/roles', admin);
check('user-service: roles catalog', rolesR.status === 200 && rolesR.json.roles?.length >= 6);

// 3) REPORTS — generate (→ MinIO), get job
const genR = await api('POST', '/reports/generate', admin, {
  reportType: 'client-ledger', format: 'pdf', params: { clientRef: 'CL0001' }, download: false,
});
const reportId = genR.json.id;
check('reports-service: generate PDF', genR.status === 201 && genR.json.storageRef?.startsWith('reports/'),
  genR.json.storageRef);

// 4) STORAGE — download the generated report bytes back from MinIO
const dl = await fetch(`${base}/reports/${reportId}/download`, { headers: { Authorization: `Bearer ${admin}` } });
const reportBytes = Buffer.from(await dl.arrayBuffer());
const isPdf = reportBytes.slice(0, 5).toString() === '%PDF-';
check('storage(MinIO): report round-trip', dl.status === 200 && isPdf, `${reportBytes.length} bytes`);

// 5) DOCUMENTS — compress the report (qpdf), stored in MinIO
const cmp = await api('POST', '/documents/compress', admin, {
  documentBase64: reportBytes.toString('base64'), name: 'ledger.pdf',
});
const docId = cmp.json.id;
check('document-service: compress', cmp.status === 201 && cmp.json.storageRef?.startsWith('documents/'),
  `ratio=${cmp.json.ratio}`);

// 6) DOCUMENTS — lock the compressed doc BY ID (tests doc chaining + storage read)
const lock = await api('POST', '/documents/lock', admin, { documentId: docId, userPassword: 'secret123' });
check('document-service: lock by documentId (chaining)', lock.status === 201 && lock.json.id > docId);

// 7) EMAIL — enqueue (→ worker → MTA accepts)
const send = await api('POST', '/email/send', admin, {
  to: ['integration@example.com'], subject: 'Integration test', text: 'hello',
});
const emailId = send.json.id;
check('email-service: enqueue', send.status === 202 && !!emailId, `status=${send.json.status}`);
// poll outbox status briefly (worker → MTA)
let emailStatus = send.json.status;
for (let i = 0; i < 8 && !['sent', 'failed', 'deferred'].includes(emailStatus); i++) {
  await new Promise((r) => setTimeout(r, 800));
  const m = await api('GET', `/email/messages/${emailId}`, admin);
  emailStatus = m.json.status;
}
check('email-service: worker→MTA processed', ['sent', 'deferred'].includes(emailStatus),
  `outbox status=${emailStatus} (sent=MTA accepted; deferred=MTA/relay retry)`);

// 8) ESIGN — wiring + status (token may be absent; just confirm it responds)
const esign = await api('GET', '/esign/status', admin);
check('esign-service: status reachable', esign.status === 200, JSON.stringify(esign.json));

// 9) EMAIL health (relay reachability + outbox counts) — cross-check
const eh = await api('GET', '/email/health', admin);
check('email-service: health', eh.status === 200, `transport.ok=${eh.json.transport?.ok}`);

// 10) RBAC enforcement across modules
const opsUsers = await api('POST', '/auth/register', ops, { email: 'x@y.net', password: 'Xpass#1234', fullName: 'X', role: 'support' });
check('RBAC: operations denied users:manage (register)', opsUsers.status === 403);
const clientGen = await api('POST', '/reports/generate', client, { reportType: 'client-ledger', format: 'pdf' });
check('RBAC: client denied reports:generate', clientGen.status === 403);
const opsRead = await api('GET', '/reports?limit=1', ops);
check('RBAC: operations allowed reports:read', opsRead.status === 200);

// ── Summary ────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
await pool.end();
process.exit(passed === results.length ? 0 : 1);
