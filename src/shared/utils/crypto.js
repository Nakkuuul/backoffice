import crypto from 'node:crypto';

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets at rest, such
 * as the DSC token PIN. The key is supplied as a base64-encoded 32-byte value
 * (config.esign.encKey) and must be kept out of the database.
 *
 * Returns/accepts the three GCM components separately so they map cleanly onto
 * BYTEA columns.
 */
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function loadKey(base64Key) {
  if (!base64Key) throw new Error('Encryption key is not configured (set ESIGN_ENC_KEY)');
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64-encoded)');
  return key;
}

/** @returns {{iv: Buffer, tag: Buffer, cipher: Buffer}} */
export function encryptSecret(plaintext, base64Key) {
  const key = loadKey(base64Key);
  const iv = crypto.randomBytes(IV_BYTES);
  const c = crypto.createCipheriv(ALGO, key, iv);
  const cipher = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return { iv, tag, cipher };
}

/** @returns {string} the recovered plaintext */
export function decryptSecret({ iv, tag, cipher }, base64Key) {
  const key = loadKey(base64Key);
  const d = crypto.createDecipheriv(ALGO, key, Buffer.from(iv));
  d.setAuthTag(Buffer.from(tag));
  return Buffer.concat([d.update(Buffer.from(cipher)), d.final()]).toString('utf8');
}
