import { query, withTransaction } from '../../db/pool.js';
import { ESIGN_EVENT } from './esign.constants.js';

/**
 * Data access for eSign requests + audit events. All SQL lives here; the
 * service layer never touches the pool directly.
 */

export async function createRequest(client, data) {
  const { rows } = await client.query(
    `INSERT INTO esign_requests
       (source_module, document_ref, document_name, document_sha256, status, requested_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.sourceModule,
      data.documentRef ?? null,
      data.documentName,
      data.documentSha256 ?? null,
      data.status,
      data.requestedBy ?? null,
    ],
  );
  return rows[0];
}

export async function updateRequest(client, id, fields) {
  // Build a dynamic SET clause from provided fields (snake_case columns).
  const allowed = [
    'status',
    'error',
    'signature_algo',
    'cert_serial',
    'cert_subject',
    'signed_sha256',
    'signed_at',
    'delivered_to',
    'sent_at',
  ];
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    values.push(value);
    sets.push(`${key} = $${values.length}`);
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  values.push(id);
  await client.query(
    `UPDATE esign_requests SET ${sets.join(', ')} WHERE id = $${values.length}`,
    values,
  );
}

export async function addAuditEvent(client, requestId, event, detail = null) {
  await client.query(
    `INSERT INTO esign_audit_events (request_id, event, detail) VALUES ($1, $2, $3)`,
    [requestId, event, detail ? JSON.stringify(detail) : null],
  );
}

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM esign_requests WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function list({ status, limit, offset }) {
  const where = status ? `WHERE status = $3` : '';
  const params = status ? [limit, offset, status] : [limit, offset];
  const { rows } = await query(
    `SELECT * FROM esign_requests ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}

/** Convenience: run a unit of work in a transaction and log an audit event. */
export { withTransaction, ESIGN_EVENT };
