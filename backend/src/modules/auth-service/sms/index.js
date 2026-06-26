import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Pluggable outbound SMS — used for OTP delivery in the password-reset flow.
 * There is no on-prem SMS gateway yet, so the default 'stub' provider only logs
 * (and surfaces the code in non-prod for testing). Swap in a real provider
 * (MSG91 / Twilio / Gupshup) by adding a case here — the service is agnostic.
 */
const stubProvider = {
  name: 'stub',
  async send({ to, message }) {
    logger.warn(
      { to, sender: config.sms.senderId },
      `sms(stub): would send SMS${config.isProd ? '' : ` — "${message}"`}`,
    );
    return { ok: true, provider: 'stub' };
  },
};

export function getSmsProvider() {
  switch (config.sms.provider) {
    case 'stub':
    default:
      return stubProvider;
  }
}
