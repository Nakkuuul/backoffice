import { Pkcs11PdfSigner } from './Pkcs11PdfSigner.js';

/**
 * Factory for the active signing backend. Today there is one (PKCS#11);
 * swap here to introduce a soft-cert signer for tests or a cloud HSM later.
 * A single shared instance is fine — it holds no device handles between calls.
 */
let instance;

export function getSigner() {
  if (!instance) {
    instance = new Pkcs11PdfSigner();
  }
  return instance;
}
