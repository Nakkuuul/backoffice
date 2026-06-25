/**
 * Exercises the eSign HTTP endpoint end-to-end against a running server.
 *   node scripts/test-api.mjs   (server must be listening on PORT)
 */
import jwt from 'jsonwebtoken';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { config } from '../src/config/index.js';

const base = `http://localhost:${config.app.port}/api/v1`;
const token = jwt.sign({ id: 1, role: 'admin' }, config.auth.jwtSecret, { expiresIn: '5m' });
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function makePdfB64() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 160]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Contract note via API', { x: 20, y: 120, size: 12, font });
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes).toString('base64');
}

const status = await (await fetch(`${base}/esign/status`, { headers: auth })).json();
console.log('status:', status);

const pinStatus = await (await fetch(`${base}/esign/config/pin`, { headers: auth })).json();
console.log('pin status:', pinStatus);

const res = await fetch(`${base}/esign/sign`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ documentName: 'contract-note.pdf', documentBase64: await makePdfB64() }),
});
const body = await res.json();
console.log('sign HTTP', res.status);
if (res.ok) {
  console.log('request row:', {
    id: body.request.id,
    status: body.request.status,
    cert_subject: body.request.cert_subject,
    cert_serial: body.request.cert_serial,
    signed_at: body.request.signed_at,
  });
  console.log('signedBase64 length:', body.signedBase64.length);
} else {
  console.log('error:', body.error);
}

const id = body?.request?.id;
if (id) {
  const one = await (await fetch(`${base}/esign/requests/${id}`, { headers: auth })).json();
  console.log('fetched request status:', one.status);
}
process.exit(0);
