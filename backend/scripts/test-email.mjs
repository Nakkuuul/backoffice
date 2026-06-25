/**
 * End-to-end email-service test against a local SMTP sink (no real relay).
 *   node scripts/test-email.mjs
 * Verifies: enqueue → outbox row, idempotency, suppression, and worker delivery
 * (claim via SKIP LOCKED → send over SMTP → marked 'sent').
 */
// Point config at a local sink BEFORE the config module loads (env is read at
// import time, and is consistent across every config-module instance).
process.env.SMTP_HOST ||= '127.0.0.1';
process.env.SMTP_PORT ||= '2526';
process.env.SMTP_SECURE ||= 'false';
process.env.EMAIL_POLL_INTERVAL_MS ||= '200';
process.env.EMAIL_WORKER_CONCURRENCY ||= '2';

const { SMTPServer } = await import('smtp-server');
const { config } = await import('../src/config/index.js');
const { pool } = await import('../src/db/pool.js');

const PORT = Number(process.env.SMTP_PORT);

const received = [];
const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS', 'AUTH'], // plaintext sink — no cert needed
  onData(stream, _session, cb) {
    let data = '';
    stream.on('data', (c) => (data += c));
    stream.on('end', () => {
      received.push(data);
      cb();
    });
  },
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`local SMTP sink listening on ${PORT}`);

// Clean slate so the worker only sees rows from this run.
await pool.query(`TRUNCATE email_messages, email_attachments, email_events RESTART IDENTITY CASCADE`);
await pool.query(`DELETE FROM email_suppressions WHERE address = 'blocked@example.com'`);

const { enqueue, suppress } = await import('../src/modules/email-service/email.service.js');
const { EmailWorker } = await import('../src/modules/email-service/email.worker.js');
console.log('worker will use SMTP', config.email.smtp.host + ':' + config.email.smtp.port);

// 1) enqueue with a template + attachment
const r1 = await enqueue({
  to: ['client@example.com'],
  template: 'signed-document',
  templateData: { clientName: 'Asha', documentTitle: 'Contract Note 25-Jun', subject: 'Your signed contract note' },
  attachments: [{ filename: 'note.pdf', content: Buffer.from('%PDF-1.4 test'), contentType: 'application/pdf' }],
  sourceModule: 'esign-service',
  sourceRef: '42',
});
console.log('enqueue:', r1);

// 2) idempotency
const a = await enqueue({ to: ['dup@example.com'], subject: 'Dup test', text: 'hi', idempotencyKey: 'k-1' });
const b = await enqueue({ to: ['dup@example.com'], subject: 'Dup test', text: 'hi', idempotencyKey: 'k-1' });
console.log('idempotency deduped:', b.deduped === true && a.id === b.id);

// 3) suppression
await suppress('blocked@example.com', 'manual', 'test');
const s = await enqueue({ to: ['blocked@example.com'], subject: 'Blocked', text: 'should not send' });
console.log('suppressed pre-queue:', s.status === 'suppressed');

// 4) run the worker until the templated message is delivered
const worker = new EmailWorker();
worker.start();
const deadline = Date.now() + 8000;
while (received.length === 0 && Date.now() < deadline) await sleep(200);
await worker.stop();

console.log(`\nSMTP sink received ${received.length} message(s)`);
if (received[0]) {
  const headers = received[0].split('\r\n\r\n')[0];
  console.log('--- first message headers ---');
  console.log(headers.split('\r\n').filter((l) => /^(From|To|Subject|Message-ID|Content-Type|List-)/i.test(l)).join('\n'));
}

// verify DB state
const { rows } = await pool.query(`SELECT id, status FROM email_messages WHERE id=$1`, [r1.id]);
console.log('\noutbox row status:', rows[0]);
console.log(rows[0]?.status === 'sent' && received.length >= 1 ? '\n✅ EMAIL PIPELINE OK' : '\n❌ PIPELINE ISSUE');

server.close();
await pool.end();
process.exit(0);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
