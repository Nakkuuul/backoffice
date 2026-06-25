/**
 * Send ONE real test email through the full pipeline:
 *   app enqueue → DKIM-sign → worker → Haraka MTA → direct-to-MX → recipient
 *
 *   node scripts/send-test-email.mjs you@gmail.com
 *
 * "sent" here means our MTA ACCEPTED the message (queued to its outbound). The
 * actual inbox/spam/bounce outcome is in the Haraka logs (docker logs).
 */
import { config } from '../src/config/index.js';
import { pool } from '../src/db/pool.js';

const to = process.argv[2] || process.env.TEST_TO;
if (!to) {
  console.error('Usage: node scripts/send-test-email.mjs <recipient@example.com>');
  process.exit(1);
}
console.log(`From: ${config.email.fromName} <${config.email.from}>`);
console.log(`Via SMTP: ${config.email.smtp.host}:${config.email.smtp.port} | DKIM: ${config.email.dkim.enabled}`);
console.log(`To: ${to}\n`);

const { enqueue } = await import('../src/modules/email-service/email.service.js');
const { EmailWorker } = await import('../src/modules/email-service/email.worker.js');

const r = await enqueue({
  to: [to],
  template: 'generic',
  templateData: {
    subject: 'Test email from Sapphire Broking',
    message:
      'Hello,\n\nThis is a test email sent from the Sapphire Broking backoffice through our own SMTP server.\n\nIf you are reading this, end-to-end delivery is working.\n\nRegards,\nSapphire Broking',
  },
  subject: 'Test email from Sapphire Broking',
  sourceModule: 'test',
});
console.log('enqueued:', r);

const w = new EmailWorker();
w.start();
const deadline = Date.now() + 30000;
let row;
while (Date.now() < deadline) {
  const { rows } = await pool.query(
    'SELECT status, attempts, last_error FROM email_messages WHERE id=$1',
    [r.id],
  );
  row = rows[0];
  if (row && ['sent', 'failed'].includes(row.status)) break;
  await new Promise((res) => setTimeout(res, 1000));
}
await w.stop();
console.log('\noutbox result:', row);
console.log(
  row?.status === 'sent'
    ? '\n✅ Accepted by our MTA. Now check `docker logs backoffice-mta` for the direct-to-MX delivery result.'
    : '\n❌ Not accepted by MTA — see last_error above.',
);
await pool.end();
process.exit(0);
