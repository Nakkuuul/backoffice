import { query, withTransaction } from '../../db/pool.js';
import { EMAIL_STATUS } from './email.constants.js';

/**
 * Data access for the email outbox. All SQL lives here. The claim query is the
 * throughput-critical path — it uses FOR UPDATE SKIP LOCKED so any number of
 * worker processes can drain the same outbox without double-sending.
 */

/** Insert a message (+ attachments) in one transaction. Returns the row. */
export async function insertMessage(msg) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO email_messages
         (idempotency_key, from_address, from_name, to_addresses, cc_addresses,
          bcc_addresses, reply_to, subject, body_html, body_text, headers,
          template, source_module, source_ref, priority, status, max_attempts, next_attempt_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
       RETURNING *`,
      [
        msg.idempotencyKey ?? null,
        msg.from,
        msg.fromName ?? null,
        msg.to,
        msg.cc ?? null,
        msg.bcc ?? null,
        msg.replyTo ?? null,
        msg.subject,
        msg.html ?? null,
        msg.text ?? null,
        msg.headers ? JSON.stringify(msg.headers) : null,
        msg.template ?? null,
        msg.sourceModule ?? null,
        msg.sourceRef ?? null,
        msg.priority ?? 5,
        msg.status ?? EMAIL_STATUS.QUEUED,
        msg.maxAttempts ?? 6,
      ],
    );
    const row = rows[0];

    for (const att of msg.attachments ?? []) {
      await client.query(
        `INSERT INTO email_attachments
           (message_id, filename, content_type, content, storage_ref, content_sha256, size_bytes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          row.id,
          att.filename,
          att.contentType ?? 'application/octet-stream',
          att.content ?? null,
          att.storageRef ?? null,
          att.sha256 ?? null,
          att.size ?? (att.content ? att.content.length : null),
        ],
      );
    }
    await client.query(
      `INSERT INTO email_events (message_id, event, detail) VALUES ($1,'queued',$2)`,
      [row.id, JSON.stringify({ to: msg.to })],
    );
    return row;
  });
}

/** Look up an existing message by idempotency key (for safe re-enqueue). */
export async function findByIdempotencyKey(key) {
  const { rows } = await query(`SELECT * FROM email_messages WHERE idempotency_key = $1`, [key]);
  return rows[0] ?? null;
}

/**
 * Atomically claim up to `limit` due messages for this worker. Marks them
 * 'sending' and stamps locked_by/locked_at. Concurrent workers never grab the
 * same rows thanks to SKIP LOCKED.
 */
export async function claimBatch(workerId, limit) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM email_messages
         WHERE status IN ('queued','deferred') AND next_attempt_at <= now()
         ORDER BY priority ASC, next_attempt_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1`,
      [limit],
    );
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const { rows: claimed } = await client.query(
      `UPDATE email_messages
         SET status='sending', locked_by=$1, locked_at=now(), attempts=attempts+1, updated_at=now()
       WHERE id = ANY($2::bigint[])
       RETURNING *`,
      [workerId, ids],
    );
    return claimed;
  });
}

/** Load attachments for a message. */
export async function getAttachments(messageId) {
  const { rows } = await query(
    `SELECT filename, content_type, content, storage_ref, size_bytes
       FROM email_attachments WHERE message_id = $1`,
    [messageId],
  );
  return rows;
}

export async function markSent(id, providerMessageId) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE email_messages
         SET status='sent', provider_message_id=$2, sent_at=now(),
             locked_by=NULL, locked_at=NULL, last_error=NULL, updated_at=now()
       WHERE id=$1`,
      [id, providerMessageId ?? null],
    );
    await client.query(
      `INSERT INTO email_events (message_id, event, detail) VALUES ($1,'sent',$2)`,
      [id, JSON.stringify({ providerMessageId })],
    );
  });
}

/** Transient failure → defer with backoff, or dead-letter if attempts exhausted. */
export async function markFailure(id, { error, attempts, maxAttempts, backoffMs }) {
  const dead = attempts >= maxAttempts;
  await withTransaction(async (client) => {
    if (dead) {
      await client.query(
        `UPDATE email_messages
           SET status='failed', last_error=$2, locked_by=NULL, locked_at=NULL, updated_at=now()
         WHERE id=$1`,
        [id, error],
      );
      await client.query(
        `INSERT INTO email_events (message_id, event, detail) VALUES ($1,'failed',$2)`,
        [id, JSON.stringify({ error, attempts })],
      );
    } else {
      await client.query(
        `UPDATE email_messages
           SET status='deferred', last_error=$2, locked_by=NULL, locked_at=NULL,
               next_attempt_at = now() + ($3 || ' milliseconds')::interval, updated_at=now()
         WHERE id=$1`,
        [id, error, String(backoffMs)],
      );
      await client.query(
        `INSERT INTO email_events (message_id, event, detail) VALUES ($1,'deferred',$2)`,
        [id, JSON.stringify({ error, attempts, backoffMs })],
      );
    }
  });
}

export async function markSuppressed(id, addresses) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE email_messages SET status='suppressed', locked_by=NULL, locked_at=NULL, updated_at=now() WHERE id=$1`,
      [id],
    );
    await client.query(
      `INSERT INTO email_events (message_id, event, detail) VALUES ($1,'suppressed',$2)`,
      [id, JSON.stringify({ addresses })],
    );
  });
}

/* ── Suppression list ─────────────────────────────────────────────────────── */

export async function isSuppressed(addresses) {
  const { rows } = await query(
    `SELECT address FROM email_suppressions WHERE address = ANY($1::text[])`,
    [addresses.map((a) => a.toLowerCase())],
  );
  return rows.map((r) => r.address);
}

export async function addSuppression(address, reason, detail) {
  await query(
    `INSERT INTO email_suppressions (address, reason, detail)
     VALUES ($1,$2,$3)
     ON CONFLICT (address) DO UPDATE SET reason=EXCLUDED.reason, detail=EXCLUDED.detail`,
    [address.toLowerCase(), reason, detail ?? null],
  );
}

export async function removeSuppression(address) {
  await query(`DELETE FROM email_suppressions WHERE address=$1`, [address.toLowerCase()]);
}

/* ── Reads for API ────────────────────────────────────────────────────────── */

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM email_messages WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function list({ status, limit, offset }) {
  const where = status ? `WHERE status=$3` : '';
  const params = status ? [limit, offset, status] : [limit, offset];
  const { rows } = await query(
    `SELECT id, to_addresses, subject, status, attempts, source_module, source_ref,
            created_at, sent_at, last_error
       FROM email_messages ${where}
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}

/** Aggregate counts per status (for the health/metrics endpoint). */
export async function statusCounts() {
  const { rows } = await query(`SELECT status, count(*)::int AS n FROM email_messages GROUP BY status`);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
