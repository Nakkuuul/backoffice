import nodemailer from 'nodemailer';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';
import { getDkim } from './dkim.js';

/**
 * Thin wrapper over a pooled nodemailer SMTP transport.
 *
 * - One pooled transport per worker process (persistent connections, pipelined
 *   messages) — this is what makes per-process throughput reasonable.
 * - DKIM signing applied to every message when configured.
 * - `rateLimit` (msgs/sec) lets each worker respect relay/ISP throttles; the
 *   real fleet throughput is (workers × per-worker rate).
 *
 * The transport is intentionally dumb: it sends ONE already-rendered message
 * and returns the relay's response. Queueing, retries, and suppression live in
 * the worker/service layers.
 */
export class SmtpTransport {
  #tx;

  #transport() {
    if (this.#tx) return this.#tx;
    const s = config.email.smtp;
    if (!s.host) throw new Error('SMTP not configured (set SMTP_HOST)');

    this.#tx = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
      tls: { rejectUnauthorized: s.rejectUnauthorized },
      pool: true,
      maxConnections: s.maxConnections,
      maxMessages: s.maxMessages,
      ...(s.rateLimit > 0 ? { rateDelta: 1000, rateLimit: s.rateLimit } : {}),
      dkim: getDkim() ?? undefined,
    });
    return this.#tx;
  }

  /** Verify connectivity/credentials against the relay (used by health check). */
  async verify() {
    return this.#transport().verify();
  }

  /**
   * Send one message.
   * @param {object} msg nodemailer message (from/to/subject/html/text/attachments/headers)
   * @returns {Promise<{messageId:string, response:string, accepted:string[], rejected:string[]}>}
   */
  async send(msg) {
    const info = await this.#transport().sendMail(msg);
    return {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted ?? [],
      rejected: info.rejected ?? [],
    };
  }

  /** Close pooled connections on shutdown. */
  close() {
    try {
      this.#tx?.close();
    } catch (err) {
      logger.warn({ err }, 'email: error closing SMTP transport');
    }
    this.#tx = undefined;
  }
}
