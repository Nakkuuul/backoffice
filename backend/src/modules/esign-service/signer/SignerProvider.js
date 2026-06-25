/**
 * SignerProvider — the abstraction every signing backend implements.
 *
 * The rest of the eSign module depends ONLY on this interface, never on a
 * concrete token/library. That keeps the hardware details (PKCS#11 .dll,
 * PINs, vendor quirks) isolated and swappable — e.g. a PKCS#11 token now, a
 * cloud HSM or a soft-cert in tests later.
 *
 * Implementations must be safe to construct even when the token is absent;
 * the actual device is only touched inside getStatus()/getCertificate()/sign().
 */
export class SignerProvider {
  /** @returns {boolean} whether the provider is configured & enabled. */
  isEnabled() {
    return false;
  }

  /**
   * Probe the device without signing. Used by the health endpoint.
   * @returns {Promise<{available: boolean, tokenPresent: boolean, slots?: number, detail?: string}>}
   */
  async getStatus() {
    throw new NotImplemented('getStatus');
  }

  /**
   * Read the signing certificate currently on the token.
   * @returns {Promise<{subject: string, issuer: string, serial: string, validFrom: string, validTo: string}>}
   */
  async getCertificate() {
    throw new NotImplemented('getCertificate');
  }

  /**
   * Apply a PAdES signature to a PDF using the DSC.
   * @param {Buffer} pdfBuffer raw, unsigned PDF bytes
   * @param {object} [options] appearance / reason / location overrides
   * @returns {Promise<{signed: Buffer, certSerial: string, certSubject: string, algorithm: string}>}
   */
  // eslint-disable-next-line no-unused-vars
  async signPdf(pdfBuffer, options) {
    throw new NotImplemented('signPdf');
  }
}

export class NotImplemented extends Error {
  constructor(method) {
    super(`SignerProvider.${method}() is not implemented by this backend`);
    this.name = 'NotImplemented';
  }
}
