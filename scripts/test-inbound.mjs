/**
 * Simulate an inbound bounce (DSN) arriving at the MTA on :25 and verify the
 * full inbound path: Haraka accepts (local domain) → forwards to the app
 * webhook → app classifies as a permanent bounce → suppresses the address.
 *
 *   node scripts/test-inbound.mjs           (app + MTA must be running)
 */
import net from 'node:net';
import { pool } from '../src/db/pool.js';

const HOST = '127.0.0.1';
const PORT = 25;
const FAILED = `nobody-${Date.now()}@example.com`; // the "bounced" address

const dsn = [
  'From: MAILER-DAEMON@sapphirebroking.net',
  'To: bounce@sapphirebroking.net',
  'Subject: Delivery Status Notification (Failure)',
  'MIME-Version: 1.0',
  'Content-Type: multipart/report; report-type=delivery-status; boundary="b"',
  '',
  '--b',
  'Content-Type: text/plain',
  '',
  `Delivery to ${FAILED} failed permanently.`,
  '',
  '--b',
  'Content-Type: message/delivery-status',
  '',
  'Reporting-MTA: dns; mail.sapphirebroking.net',
  '',
  `Final-Recipient: rfc822; ${FAILED}`,
  'Action: failed',
  'Status: 5.1.1',
  'Diagnostic-Code: smtp; 550 5.1.1 user unknown',
  '',
  '--b--',
  '',
].join('\r\n');

function smtp() {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(PORT, HOST);
    sock.setTimeout(15000);
    let step = 0;
    const script = [
      { expect: '220', send: 'EHLO tester\r\n' },
      { expect: '250', send: 'MAIL FROM:<>\r\n' },
      { expect: '250', send: 'RCPT TO:<bounce@sapphirebroking.net>\r\n' },
      { expect: '250', send: 'DATA\r\n' },
      { expect: '354', send: dsn + '\r\n.\r\n' },
      { expect: '250', send: 'QUIT\r\n' },
    ];
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString();
      if (!buf.endsWith('\n')) return;
      const line = buf.trim();
      const cur = script[step];
      if (!line.startsWith(cur.expect)) {
        sock.destroy();
        return reject(new Error(`step ${step}: expected ${cur.expect}, got: ${line}`));
      }
      console.log(`<- ${line.split('\r\n').pop()}`);
      buf = '';
      step++;
      if (step < script.length) {
        sock.write(script[step - 1].send);
      } else {
        sock.end();
        resolve();
      }
    });
    sock.on('timeout', () => { sock.destroy(); reject(new Error('SMTP timeout')); });
    sock.on('error', reject);
  });
}

console.log(`Submitting simulated bounce for ${FAILED} to ${HOST}:${PORT} ...`);
await smtp();
console.log('MTA accepted the DSN. Checking app processing...\n');

await new Promise((r) => setTimeout(r, 1500));
const inbound = await pool.query(
  `SELECT id, type, related_address, dsn_status FROM email_inbound ORDER BY id DESC LIMIT 1`,
);
const supp = await pool.query(`SELECT address, reason FROM email_suppressions WHERE address=$1`, [
  FAILED.toLowerCase(),
]);

console.log('email_inbound:', inbound.rows[0]);
console.log('email_suppressions:', supp.rows[0] || '(none)');
const ok = inbound.rows[0]?.type === 'bounce' && supp.rows.length === 1;
console.log(ok ? '\n✅ INBOUND BOUNCE → SUPPRESSION OK' : '\n❌ inbound flow issue');

await pool.end();
process.exit(0);
