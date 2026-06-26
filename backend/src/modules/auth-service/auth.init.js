import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';
import { ensureMaster } from './auth.service.js';

/**
 * Seed the master super_admin on first boot. Idempotent — skips if a super_admin
 * already exists. The master is created with must_change_password=true, so its
 * first login forces a password reset.
 */
export async function initAuthService() {
  // Fail fast: 2FA needs an encryption key for TOTP secrets at rest. Don't boot
  // into a state where enrollment 500s on the first attempt.
  if (config.auth.twoFactor.enabled && !config.auth.encKey) {
    throw new Error(
      'Two-factor auth is enabled (AUTH_2FA_ENABLED) but no encryption key is set. ' +
        'Set AUTH_ENC_KEY (or ESIGN_ENC_KEY) to a base64-encoded 32-byte key.',
    );
  }

  const res = await ensureMaster();
  if (res.created) {
    logger.warn(
      { email: res.email },
      'auth: seeded MASTER super_admin — FIRST LOGIN WILL FORCE A PASSWORD CHANGE. ' +
        'Set AUTH_MASTER_PASSWORD (default is a placeholder).',
    );
  } else {
    logger.info({ reason: res.reason }, 'auth: master user already present');
  }
}
