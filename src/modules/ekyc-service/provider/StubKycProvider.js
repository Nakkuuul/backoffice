import { KycProvider } from './KycProvider.js';
import { CHECK_TYPE } from '../ekyc.constants.js';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Stub verification provider — validates format and returns a MOCK verified
 * result so the KYC workflow is testable end-to-end. Real providers (NSDL PAN,
 * UIDAI/DigiLocker Aadhaar, bank penny-drop) replace this behind the same
 * KycProvider interface. Every result is flagged `mock: true`.
 */
export class StubKycProvider extends KycProvider {
  async verify(type, payload = {}) {
    const base = { provider: 'stub', detail: { mock: true } };
    switch (type) {
      case CHECK_TYPE.PAN: {
        const ok = PAN_RE.test((payload.pan || '').toUpperCase());
        return { ...base, verified: ok, reference: ok ? `STUBPAN-${payload.pan}` : undefined,
          detail: { mock: true, nameMatch: ok, ...(ok ? {} : { error: 'invalid PAN format' }) } };
      }
      case CHECK_TYPE.BANK: {
        const ok = Boolean(payload.accountNumber) && IFSC_RE.test(payload.ifsc || '');
        return { ...base, verified: ok, reference: ok ? `STUBBANK-${payload.accountNumber}` : undefined,
          detail: { mock: true, ...(ok ? { nameAtBank: payload.name ?? null } : { error: 'invalid account/IFSC' }) } };
      }
      case CHECK_TYPE.AADHAAR:
      case CHECK_TYPE.MOBILE:
      case CHECK_TYPE.EMAIL:
      case CHECK_TYPE.IPV:
      case CHECK_TYPE.LIVENESS:
      case CHECK_TYPE.PHOTO:
      case CHECK_TYPE.SIGNATURE:
        // Mock OTP/visual checks as passed.
        return { ...base, verified: true, reference: `STUB-${type}-${Date.now()}` };
      default:
        return { ...base, verified: false, detail: { mock: true, error: `unknown check type ${type}` } };
    }
  }
}
