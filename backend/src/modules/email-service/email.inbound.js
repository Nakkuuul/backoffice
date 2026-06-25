import { simpleParser } from 'mailparser';
import { query } from '../../db/pool.js';
import { logger } from '../../shared/utils/logger.js';
import { addSuppression } from './email.repository.js';
import { SUPPRESSION_REASON } from './email.constants.js';

/**
 * Process one inbound message forwarded from the MTA.
 *
 * Classifies the message and, for permanent bounces and complaints, adds the
 * affected address to the suppression list automatically — this is what keeps
 * the sender reputation healthy over time (never re-mailing dead/angry
 * addresses). Everything is stored in email_inbound for audit.
 *
 * @param {string|Buffer} raw the full RFC822 message
 * @returns {Promise<{id, type, related, dsnStatus, suppressed}>}
 */
export async function processInbound(raw) {
  const rawStr = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const parsed = await simpleParser(rawStr).catch(() => ({}));

  const from = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
  const to = (parsed.to?.value || []).map((a) => a.address).filter(Boolean);
  const subject = parsed.subject || '';
  const messageId = parsed.messageId || null;

  const lower = rawStr.toLowerCase();
  const isComplaint =
    lower.includes('report-type=feedback-report') || lower.includes('feedback-type:');
  const isBounce =
    lower.includes('report-type=delivery-status') ||
    lower.includes('content-type: message/delivery-status') ||
    /mailer-daemon|postmaster@/i.test(from);

  let type = 'other';
  let related = null;
  let dsnStatus = null;
  let reason = null;

  if (isComplaint) {
    type = 'complaint';
    related = matchEmail(rawStr, [
      /Original-Rcpt-To:\s*<?([^\s<>;]+@[^\s<>;]+)>?/i,
      /Removal-Recipient:\s*<?([^\s<>;]+@[^\s<>;]+)>?/i,
    ]);
    reason = SUPPRESSION_REASON.COMPLAINT;
  } else if (isBounce) {
    type = 'bounce';
    related = matchEmail(rawStr, [/Final-Recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/i]);
    dsnStatus = rawStr.match(/Status:\s*([245]\.\d+\.\d+)/i)?.[1] || null;
    // Only permanent (5.x.x) bounces are suppressed; transient (4.x.x) are not.
    if (dsnStatus?.startsWith('5')) reason = SUPPRESSION_REASON.BOUNCE;
  } else if (to.length || /^re:/i.test(subject)) {
    type = 'reply';
  }

  const { rows } = await query(
    `INSERT INTO email_inbound
       (message_id, from_address, to_addresses, subject, type, related_address, dsn_status, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [messageId, from, to, subject, type, related?.toLowerCase() ?? null, dsnStatus, rawStr.slice(0, 1_000_000)],
  );

  let suppressed = false;
  if (related && reason) {
    await addSuppression(related.toLowerCase(), reason, `auto: ${type} ${dsnStatus ?? ''}`.trim());
    suppressed = true;
    logger.info({ address: related, reason, dsnStatus }, 'email: inbound auto-suppression');
  }

  return { id: rows[0].id, type, related, dsnStatus, suppressed };
}

function matchEmail(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
