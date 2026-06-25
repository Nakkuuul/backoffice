/**
 * Verify the document-service PDF engine (qpdf): compress, lock, unlock.
 *   node scripts/test-documents.mjs
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { compress, lock, unlock, version } from '../src/modules/document-service/pdf/qpdf.js';

const isPdf = (b) => b.slice(0, 5).toString() === '%PDF-';

console.log('qpdf:', await version());

// Build a multi-page sample PDF with repetitive text (so compression has room).
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let p = 0; p < 6; p++) {
  const page = doc.addPage([595, 842]);
  for (let i = 0; i < 40; i++) {
    page.drawText(`Sapphire Broking — sample ledger line ${p}-${i} ABCDEFGHIJKLMNOPQRSTUVWXYZ`, {
      x: 40,
      y: 800 - i * 18,
      size: 9,
      font,
    });
  }
}
const original = Buffer.from(await doc.save({ useObjectStreams: false }));
console.log(`\noriginal: ${original.length} bytes  ${isPdf(original) ? '✅' : '❌'}`);

// 1) compress
const c = await compress(original);
console.log(
  `compress: ${c.length} bytes  ${isPdf(c) ? '✅' : '❌'}  (${(100 * (1 - c.length / original.length)).toFixed(1)}% smaller)`,
);

// 2) lock
const locked = await lock(original, { userPassword: 'secret123' });
console.log(`lock    : ${locked.length} bytes  ${isPdf(locked) ? '✅' : '❌'} (encrypted)`);

// 3) wrong password must fail
let rejected = false;
try {
  await unlock(locked, 'wrongpw');
} catch {
  rejected = true;
}
console.log(`wrong pw rejected: ${rejected ? '✅' : '❌'}`);

// 4) unlock with correct password
const unlocked = await unlock(locked, 'secret123');
console.log(`unlock  : ${unlocked.length} bytes  ${isPdf(unlocked) ? '✅' : '❌'} (decrypted)`);

const ok = isPdf(c) && isPdf(locked) && rejected && isPdf(unlocked);
console.log(ok ? '\n✅ DOCUMENT-SERVICE PDF OPS OK' : '\n❌ FAILED');
process.exit(ok ? 0 : 1);
