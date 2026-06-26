import { logger } from '../../shared/utils/logger.js';
import { ensureMaster } from './auth.service.js';

/**
 * Seed the master super_admin on first boot. Idempotent — skips if a super_admin
 * already exists. The master is created with must_change_password=true, so its
 * first login forces a password reset.
 */
export async function initAuthService() {
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
