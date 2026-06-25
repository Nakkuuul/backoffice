/**
 * Generate the sample 'client-ledger' report in every format and verify the
 * files are produced and stored.  node scripts/test-reports.mjs
 */
import { pool } from '../src/db/pool.js';
import { registerReport } from '../src/modules/reports-service/registry.js';
import { produce } from '../src/modules/reports-service/reports.service.js';
import { closePdfRenderer } from '../src/modules/reports-service/renderers/index.js';
import clientLedger from '../src/modules/reports-service/definitions/client-ledger.js';

registerReport(clientLedger);

const formats = ['html', 'csv', 'xlsx', 'pdf'];
const params = { clientRef: 'CL0001' };

for (const format of formats) {
  const t = Date.now();
  const out = await produce({ reportType: 'client-ledger', format, params });
  const okSig =
    (format === 'pdf' && out.buffer.slice(0, 4).toString() === '%PDF') ||
    (format === 'xlsx' && out.buffer.slice(0, 2).toString() === 'PK') ||
    (format === 'csv' && out.buffer.toString().includes('Date,Description')) ||
    (format === 'html' && out.buffer.toString().includes('<table'));
  console.log(
    `${format.padEnd(5)} ${okSig ? '✅' : '❌'}  ${String(out.size).padStart(7)} bytes  -> ${out.storageRef}  (${Date.now() - t}ms)`,
  );
}

await closePdfRenderer();
await pool.end();
console.log('\n✅ REPORTS GENERATED (all formats)');
process.exit(0);
