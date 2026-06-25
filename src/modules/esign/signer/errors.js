import { AppError } from '../../../shared/errors/AppError.js';

/** eSign turned off via config. */
export class EsignDisabledError extends AppError {
  constructor() {
    super('eSign is disabled (set ESIGN_ENABLED=true)', 503, { code: 'ESIGN_DISABLED' });
  }
}

/** Missing PKCS#11 library path or PIN. */
export class Pkcs11NotConfiguredError extends AppError {
  constructor(msg = 'PKCS#11 not configured (set PKCS11_LIB_PATH and PKCS11_PIN)') {
    super(msg, 503, { code: 'PKCS11_NOT_CONFIGURED' });
  }
}

/** A required native dependency isn't installed. */
export class Pkcs11DependencyMissingError extends AppError {
  constructor(pkg) {
    super(
      `Native dependency "${pkg}" is not installed. See src/modules/esign/README.md`,
      501,
      { code: 'PKCS11_DEPENDENCY_MISSING' },
    );
  }
}

/** Token not present, wrong PIN, or no usable key/cert on it. */
export class TokenUnavailableError extends AppError {
  constructor(msg = 'DSC token not detected on any PKCS#11 slot') {
    super(msg, 503, { code: 'TOKEN_UNAVAILABLE' });
  }
}
