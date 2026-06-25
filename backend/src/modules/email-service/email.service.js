import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import * as repo from './email.repository.js';
import { render } from './templates/index.js';
import { getTransport } from './transport/index.js';
import { EMAIL_STATUS, SUPPRESSION_REASON } from './email.constants.js';

/**
 * Enqueue an email into the durable outbox. Returns immediately — actual
 * delivery is performed asynchronously by the worker fleet. This decoupling is
 * what lets the system accept a 100M burst and drain it at the relay's pace.
 *
 * @param {object} input
 * @param {string[]} input.to
 * @param {string} [input.subject]
 * @param {string} [input.html]
 * @param {string} [input.text]
 * @param {string} [input.template]            template name (overrides subject/html/text)
 * @param {object} [input.templateData]
 * @param {Array}  [input.attachments]         [{filename, content(Buffer)|storageRef, contentType}]
 * @param {string} [input.idempotencyKey]
 * @returns {Promise<{id, status, deduped:boolean}>}
 */
export async function enqueue(input) {
  if (!input.to?.length) throw new BadRequestError('At least one recipient (to) is required');

  // Idempotent re-enqueue.
  if (input.idempotencyKey) {
    const existing = await repo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return { id: existing.id, status: existing.status, deduped: true };
  }

  // Resolve content from a template if provided.
  let { subject, html, text } = input;
  if (input.template) {
    const rendered = render(input.template, input.templateData ?? {});
    subject = input.subject ?? rendered.subject;
    html = rendered.html;
    text = rendered.text;
  }
  if (!subject) throw new BadRequestError('subject is required (or use a template)');
  if (!html && !text) throw new BadRequestError('Provide html, text, or a template');

  // Pre-filter against the suppression list so we don't even queue dead addresses.
  const suppressed = await repo.isSuppressed(input.to);
  const to = input.to.filter((a) => !suppressed.includes(a.toLowerCase()));
  if (to.length === 0) {
    return { id: null, status: EMAIL_STATUS.SUPPRESSED, deduped: false, suppressed };
  }

  const row = await repo.insertMessage({
    idempotencyKey: input.idempotencyKey,
    from: config.email.from,
    fromName: config.email.fromName,
    to,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo || config.email.replyTo || undefined,
    subject,
    html,
    text,
    headers: buildHeaders(input.headers),
    template: input.template,
    sourceModule: input.sourceModule,
    sourceRef: input.sourceRef,
    priority: input.priority ?? 5,
    maxAttempts: config.email.worker.maxAttempts,
    attachments: (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: a.content,
      storageRef: a.storageRef,
      sha256: a.content ? sha256(a.content) : a.sha256,
      size: a.content?.length ?? a.size,
    })),
  });

  return { id: row.id, status: row.status, deduped: false };
}

/** Deliverability headers applied to every message. */
function buildHeaders(custom = {}) {
  const headers = { ...custom };
  // One-click unsubscribe greatly improves bulk-sender reputation (RFC 8058).
  if (config.email.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${config.email.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  return Object.keys(headers).length ? headers : undefined;
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* ── Suppression management ─────────────────────────────────────────────────── */

export function suppress(address, reason = SUPPRESSION_REASON.MANUAL, detail) {
  return repo.addSuppression(address, reason, detail);
}
export function unsuppress(address) {
  return repo.removeSuppression(address);
}

/* ── Reads ──────────────────────────────────────────────────────────────────── */

export function getMessage(id) {
  return repo.findById(id);
}
export function listMessages(params) {
  return repo.list(params);
}

/** Health: relay reachable + outbox status counts. */
export async function health() {
  let transport = { ok: false };
  try {
    await getTransport().verify();
    transport = { ok: true };
  } catch (err) {
    transport = { ok: false, error: err.message };
  }
  return { transport, outbox: await repo.statusCounts() };
}

/* ── Integration port for esign-service ─────────────────────────────────────── */

/**
 * Implementation of the esign-service EmailSender port. Enqueues the signed
 * document for delivery and returns the outbox id as the message id.
 */
export async function sendMailFromEsign({ to, subject, body, attachments }) {
  const result = await enqueue({
    to,
    subject,
    text: body,
    html: render('generic', { subject, message: body }).html,
    attachments,
    sourceModule: 'esign-service',
  });
  return { messageId: String(result.id ?? `suppressed`) };
}
