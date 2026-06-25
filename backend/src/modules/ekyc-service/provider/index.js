import { config } from '../../../config/index.js';
import { StubKycProvider } from './StubKycProvider.js';

/**
 * Active KYC verification provider. Today: stub (mock). Swap here to wire real
 * providers (NSDL PAN, UIDAI/DigiLocker, penny-drop bank) by config.
 */
let instance;
export function getKycProvider() {
  if (!instance) {
    switch (config.ekyc.provider) {
      // case 'nsdl': instance = new NsdlKycProvider(); break;  // real provider, later
      case 'stub':
      default:
        instance = new StubKycProvider();
    }
  }
  return instance;
}
