import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { registerEmailSender } from '../esign-service/ports/index.js';
import { sendMailFromEsign } from './email.service.js';
import { EmailWorker } from './email.worker.js';

let worker;

/**
 * Wire the email-service into the app:
 *  1. Register it as the EmailSender for esign-service (dependency-inversion
 *     seam) so signed documents flow esign → email automatically.
 *  2. Optionally start the in-process outbox worker.
 *
 * In production at scale, run the API with the worker DISABLED
 * (EMAIL_WORKER_ENABLED=false) and run a separate fleet of `npm run email:worker`
 * processes so sending capacity scales independently of the API.
 *
 * @param {{startWorker?: boolean}} [opts]
 */
export function initEmailService({ startWorker = true } = {}) {
  registerEmailSender({ sendMail: sendMailFromEsign });
  logger.info('email: registered as esign-service EmailSender');

  if (!config.email.smtp.host) {
    logger.warn('email: SMTP_HOST not configured — outbox worker NOT started');
    return undefined;
  }
  if (startWorker && config.email.worker.enabled) {
    worker = new EmailWorker();
    worker.start();
  }
  return worker;
}

export async function stopEmailService() {
  if (worker) await worker.stop();
}
