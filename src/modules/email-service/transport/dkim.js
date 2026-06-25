import { readFileSync } from 'node:fs';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Load DKIM signing options for nodemailer, or null if DKIM is disabled or the
 * key can't be read. DKIM is the single biggest deliverability lever the app
 * controls — without it, DMARC alignment fails and mail is far more likely to
 * be filtered as spam.
 *
 * @returns {{domainName:string, keySelector:string, privateKey:string}|null}
 */
let cached;
export function getDkim() {
  if (cached !== undefined) return cached;

  const { enabled, domainName, keySelector, privateKeyPath } = config.email.dkim;
  if (!enabled) {
    cached = null;
    return cached;
  }
  if (!domainName || !privateKeyPath) {
    logger.warn('email: DKIM enabled but DKIM_DOMAIN or DKIM_PRIVATE_KEY_PATH missing');
    cached = null;
    return cached;
  }
  try {
    const privateKey = readFileSync(privateKeyPath, 'utf8');
    cached = { domainName, keySelector, privateKey };
    return cached;
  } catch (err) {
    logger.error({ err }, 'email: failed to read DKIM private key');
    cached = null;
    return cached;
  }
}
