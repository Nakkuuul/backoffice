import { createHash } from 'node:crypto';
import * as asn1js from 'asn1js';
import {
  Certificate,
  IssuerAndSerialNumber,
  SignedData,
  SignerInfo,
  EncapsulatedContentInfo,
  Attribute,
  SignedAndUnsignedAttributes,
  ContentInfo,
  AlgorithmIdentifier,
} from 'pkijs';

/* OIDs used in a CMS SignedData. */
const OID = {
  contentTypeAttr: '1.2.840.113549.1.9.3',
  messageDigestAttr: '1.2.840.113549.1.9.4',
  signingTimeAttr: '1.2.840.113549.1.9.5',
  data: '1.2.840.113549.1.7.1',
  signedData: '1.2.840.113549.1.7.2',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsaEncryption: '1.2.840.113549.1.1.1',
};

const toAB = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

/** Parse a DER certificate (Buffer) into a pkijs Certificate. */
export function parseCertificate(der) {
  const asn = asn1js.fromBER(toAB(Buffer.from(der)));
  if (asn.offset === -1) throw new Error('Failed to parse certificate DER');
  return new Certificate({ schema: asn.result });
}

/**
 * Build a detached CMS/PKCS#7 SignedData over `content`.
 *
 * The private key never leaves the token: we assemble the SignedAttributes,
 * DER-encode them as a SET OF (RFC 5652 §5.4), and hand those bytes to
 * `signRaw` — which performs the RSA operation on the DSC. The returned
 * signature is spliced back into the SignerInfo.
 *
 * @param {Buffer} content the PDF ByteRange bytes to be signed
 * @param {object} opts
 * @param {Certificate} opts.leaf signing certificate (pkijs)
 * @param {Certificate[]} opts.chain CA certificates to embed (pkijs)
 * @param {Date} opts.signingTime
 * @param {(tbs: Buffer) => Promise<Buffer>} opts.signRaw RSA-PKCS#1 SHA-256 signer on the token
 * @returns {Promise<Buffer>} DER-encoded ContentInfo (the value for /Contents)
 */
export async function buildCmsSignature(content, { leaf, chain, signingTime, signRaw }) {
  const messageDigest = createHash('sha256').update(content).digest();

  // Signed attributes — order doesn't matter; DER SET OF sorting is handled on encode.
  const attrs = [
    new Attribute({
      type: OID.contentTypeAttr,
      values: [new asn1js.ObjectIdentifier({ value: OID.data })],
    }),
    new Attribute({
      type: OID.signingTimeAttr,
      values: [new asn1js.UTCTime({ valueDate: signingTime })],
    }),
    new Attribute({
      type: OID.messageDigestAttr,
      values: [new asn1js.OctetString({ valueHex: toAB(messageDigest) })],
    }),
  ];

  const signerInfo = new SignerInfo({
    version: 1,
    sid: new IssuerAndSerialNumber({
      issuer: leaf.issuer,
      serialNumber: leaf.serialNumber,
    }),
    digestAlgorithm: new AlgorithmIdentifier({
      algorithmId: OID.sha256,
      algorithmParams: new asn1js.Null(),
    }),
    signedAttrs: new SignedAndUnsignedAttributes({ type: 0, attributes: attrs }),
  });

  // Bytes actually signed: the attributes as an explicit SET OF (tag 0x31),
  // which differs from the [0] IMPLICIT tag carried inside the message.
  const setForSigning = new asn1js.Set({ value: attrs.map((a) => a.toSchema()) });
  const tbs = Buffer.from(setForSigning.toBER(false));

  const signature = await signRaw(tbs);

  signerInfo.signatureAlgorithm = new AlgorithmIdentifier({
    algorithmId: OID.rsaEncryption,
    algorithmParams: new asn1js.Null(),
  });
  signerInfo.signature = new asn1js.OctetString({ valueHex: toAB(Buffer.from(signature)) });

  const signedData = new SignedData({
    version: 1,
    digestAlgorithms: [
      new AlgorithmIdentifier({ algorithmId: OID.sha256, algorithmParams: new asn1js.Null() }),
    ],
    encapContentInfo: new EncapsulatedContentInfo({ eContentType: OID.data }), // detached
    certificates: [leaf, ...chain],
    signerInfos: [signerInfo],
  });

  const contentInfo = new ContentInfo({
    contentType: OID.signedData,
    content: signedData.toSchema(true),
  });

  return Buffer.from(contentInfo.toSchema().toBER(false));
}
