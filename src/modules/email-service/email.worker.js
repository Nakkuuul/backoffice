import os from 'node:os';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { getTransport, closeTransport } from './transport/index.js';
import * as repo from './email.repository.js';

/**
 * Outbox worker. Runs N concurrent claim-and-send loops in this process; scale
 * THROUGHPUT by running more processes (each gets a unique id, and SKIP LOCKED
 * guarantees no two workers claim the same row). To hit the 100M/6h target you
 * run a fleet of these — see the module README for fleet sizing.
 */
export class EmailWorker {
  constructor() {
    this.id = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
    this.running = false;
    this.loops = [];
  }

  start() {
    if (this.running) return;
    this.running = true;
    const { concurrency } = config.email.worker;
    logger.info({ workerId: this.id, concurrency }, 'email: worker starting');
    for (let i = 0; i < concurrency; i++) this.loops.push(this.#loop(i));
  }

  async stop() {
    this.running = false;
    await Promise.allSettled(this.loops);
    this.loops = [];
    closeTransport();
    logger.info({ workerId: this.id }, 'email: worker stopped');
  }

  async #loop(slot) {
    const { batchSize, pollIntervalMs } = config.email.worker;
    while (this.running) {
      try {
        const batch = await repo.claimBatch(this.id, batchSize);
        if (batch.length === 0) {
          await sleep(pollIntervalMs + slot * 50); // stagger idle polling
          continue;
        }
        for (const row of batch) {
          if (!this.running) break;
          await this.#process(row);
        }
      } catch (err) {
        logger.error({ err, workerId: this.id }, 'email: worker loop error');
        await sleep(pollIntervalMs);
      }
    }
  }

  async #process(row) {
    const recipients = [
      ...(row.to_addresses ?? []),
      ...(row.cc_addresses ?? []),
      ...(row.bcc_addresses ?? []),
    ];

    // Honor suppression list. If every recipient is suppressed, don't send.
    try {
      const suppressed = await repo.isSuppressed(recipients);
      if (suppressed.length > 0) {
        const liveTo = (row.to_addresses ?? []).filter((a) => !suppressed.includes(a.toLowerCase()));
        if (liveTo.length === 0) {
          await repo.markSuppressed(row.id, suppressed);
          return;
        }
        row.to_addresses = liveTo; // drop suppressed recipients, send to the rest
      }
    } catch (err) {
      logger.warn({ err, id: row.id }, 'email: suppression check failed, proceeding');
    }

    try {
      const attachments = await repo.getAttachments(row.id);
      const message = buildMessage(row, attachments);
      const result = await getTransport().send(message);
      await repo.markSent(row.id, result.messageId);
    } catch (err) {
      const permanent = isPermanent(err);
      const attempts = row.attempts; // already incremented at claim time
      const maxAttempts = row.max_attempts;
      await repo.markFailure(row.id, {
        error: truncate(err.message, 2000),
        attempts: permanent ? maxAttempts : attempts,
        maxAttempts,
        backoffMs: backoff(attempts),
      });
      logger[permanent ? 'warn' : 'debug'](
        { id: row.id, permanent, err: err.message },
        'email: send failed',
      );
    }
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function buildMessage(row, attachments) {
  return {
    from: row.from_name ? `"${row.from_name}" <${row.from_address}>` : row.from_address,
    to: row.to_addresses,
    cc: row.cc_addresses ?? undefined,
    bcc: row.bcc_addresses ?? undefined,
    replyTo: row.reply_to ?? undefined,
    subject: row.subject,
    html: row.body_html ?? undefined,
    text: row.body_text ?? undefined,
    headers: row.headers ?? undefined,
    messageId: `<${row.id}.${crypto.randomBytes(8).toString('hex')}@${config.email.domain}>`,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      contentType: a.content_type,
      // Inline bytea today; at scale stream from object storage via storage_ref.
      content: a.content ?? undefined,
      path: a.content ? undefined : a.storage_ref ?? undefined,
    })),
  };
}

/** Permanent SMTP failures (5xx) shouldn't be retried — fail fast to DLQ. */
function isPermanent(err) {
  const code = err?.responseCode;
  return typeof code === 'number' && code >= 500 && code < 600;
}

/** Exponential backoff with jitter, capped at ~30 min. */
function backoff(attempts) {
  const base = Math.min(30 * 60 * 1000, 1000 * 2 ** attempts);
  return Math.floor(base / 2 + Math.random() * (base / 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) : s);
