/**
 * KycProvider — abstraction over identity-verification backends. The service
 * depends only on this interface; concrete providers (NSDL PAN, UIDAI/DigiLocker
 * Aadhaar, penny-drop bank verification, etc.) plug in without touching the
 * workflow — mirroring the esign SignerProvider pattern.
 *
 * @typedef {object} VerifyResult
 * @property {boolean} verified
 * @property {string}  provider
 * @property {string}  [reference]   provider's verification id
 * @property {object}  [detail]      structured response (masked/safe to store)
 * @property {string}  [error]
 */
export class KycProvider {
  /**
   * Run a verification of `type` with the given payload.
   * @param {string} type one of CHECK_TYPE
   * @param {object} payload e.g. { pan, name } | { accountNumber, ifsc } | { otp }
   * @returns {Promise<VerifyResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async verify(type, payload) {
    throw new Error('KycProvider.verify() not implemented');
  }
}
