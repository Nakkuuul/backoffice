/**
 * Standalone end-to-end eSign test against the physical DSC token.
 *   node scripts/test-sign.mjs
 * Requires a resolvable PIN (PKCS11_PIN in .env, or stored via the API).
 * Writes the signed PDF to scratch and verifies the CMS cryptographically.
 */
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as asn1js from 'asn1js';
import { ContentInfo, SignedData } from 'pkijs';
import { extractSignature } from '@signpdf/utils';
import { getSigner } from '../src/modules/esign-service/signer/index.js';

const OUT = 'scratch-signed.pdf';

/** Write the signed PDF, falling back to a numbered name if the file is locked
 * (e.g. open in a PDF viewer). */
function writeSigned(buf) {
  for (const name of [OUT, 'scratch-signed-1.pdf', 'scratch-signed-2.pdf']) {
    try {
      writeFileSync(name, buf);
      return name;
    } catch (e) {
      if (e.code !== 'EBUSY' && e.code !== 'EPERM') throw e;
    }
  }
  throw new Error('All output files are locked — close the PDF viewer and retry');
}

async function makeSamplePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Broker Backoffice — eSign test document', { x: 20, y: 150, size: 12, font });
  page.drawText(`Generated for signing test`, { x: 20, y: 120, size: 10, font });
  // Classic xref table (not an xref stream) so @signpdf can parse it.
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function verifyCms(cmsBuf, signedBytes, leafCertDer) {
  // /Contents is zero-padded to the reserved length — parse just the ASN.1.
  const ab = cmsBuf.buffer.slice(cmsBuf.byteOffset, cmsBuf.byteOffset + cmsBuf.byteLength);
  const asn = asn1js.fromBER(ab);
  if (asn.offset === -1) throw new Error('Failed to parse CMS');
  const ci = new ContentInfo({ schema: asn.result });
  const sd = new SignedData({ schema: ci.content });
  const si = sd.signerInfos[0];

  // Rebuild the SET OF signed attributes (0x31) that was actually signed.
  const setOf = new asn1js.Set({ value: si.signedAttrs.attributes.map((a) => a.toSchema()) });
  const tbs = Buffer.from(setOf.toBER(false));

  // 1) messageDigest attribute must equal SHA-256 of the ByteRange bytes.
  const mdAttr = si.signedAttrs.attributes.find((a) => a.type === '1.2.840.113549.1.9.4');
  const messageDigest = Buffer.from(mdAttr.values[0].valueBlock.valueHexView);
  const actual = crypto.createHash('sha256').update(signedBytes).digest();
  const digestOk = messageDigest.equals(actual);

  // 2) RSA signature over the signed attributes must verify against the cert.
  const signature = Buffer.from(si.signature.valueBlock.valueHexView);
  const x509 = new crypto.X509Certificate(leafCertDer);
  const sigOk = crypto.verify('RSA-SHA256', tbs, x509.publicKey, signature);

  return { digestOk, sigOk, certs: sd.certificates.length };
}

const signer = getSigner();

console.log('enabled:', signer.isEnabled());
console.log('status :', await signer.getStatus());
console.log('cert   :', await signer.getCertificate());

const pdf = await makeSamplePdf();
console.log(`\nSigning sample PDF (${pdf.length} bytes)...`);
const { signed, certSerial, certSubject, algorithm } = await signer.signPdf(pdf, {
  reason: 'eSign pipeline test',
});
const outName = writeSigned(signed);
console.log(`Signed PDF: ${signed.length} bytes -> ${outName}`);
console.log(`Signer: ${certSubject} | serial ${certSerial} | ${algorithm}`);

// Verify.
const { signature, signedData } = extractSignature(signed);
const cmsBuf = Buffer.isBuffer(signature) ? signature : Buffer.from(signature, 'binary');
const { withSigningMaterial } = await import('../src/modules/esign-service/signer/token.js');
const leaf = await withSigningMaterial(async (m) => Buffer.from(m.leaf.toSchema().toBER(false)), {
  login: false,
});

const result = verifyCms(cmsBuf, signedData, leaf);
console.log('\nVerification:', result);
console.log(result.digestOk && result.sigOk ? '\n✅ SIGNATURE VALID' : '\n❌ SIGNATURE INVALID');
process.exit(0);
