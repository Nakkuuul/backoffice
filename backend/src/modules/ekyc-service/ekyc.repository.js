import { query, withTransaction } from '../../db/pool.js';

/* ── Applications ─────────────────────────────────────────────────────────── */

export async function createApplication(a) {
  const { rows } = await query(
    `INSERT INTO kyc_applications
       (kind, source, external_ref, client_ref, full_name, email, mobile, pan,
        aadhaar_last4, changes, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      a.kind,
      a.source,
      a.externalRef ?? null,
      a.clientRef ?? null,
      a.fullName,
      a.email ?? null,
      a.mobile ?? null,
      a.pan ?? null,
      a.aadhaarLast4 ?? null,
      a.changes ? JSON.stringify(a.changes) : null,
      a.status,
      a.createdBy ?? null,
    ],
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM kyc_applications WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function findByExternalRef(ref) {
  const { rows } = await query(`SELECT * FROM kyc_applications WHERE external_ref=$1`, [ref]);
  return rows[0] ?? null;
}

export async function updateApplication(id, fields) {
  const allowed = {
    fullName: 'full_name', email: 'email', mobile: 'mobile', pan: 'pan',
    aadhaarLast4: 'aadhaar_last4', clientRef: 'client_ref', remarks: 'remarks',
    assignedTo: 'assigned_to', status: 'status',
  };
  const sets = [];
  const values = [];
  for (const [k, col] of Object.entries(allowed)) {
    if (fields[k] !== undefined) {
      values.push(fields[k]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (fields.changes !== undefined) {
    values.push(JSON.stringify(fields.changes));
    sets.push(`changes = $${values.length}`);
  }
  if (!sets.length) return findById(id);
  sets.push('updated_at = now()');
  values.push(id);
  const { rows } = await query(
    `UPDATE kyc_applications SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function setDecision(id, { status, remarks, decidedBy }) {
  const { rows } = await query(
    `UPDATE kyc_applications
       SET status=$2, remarks=COALESCE($3, remarks), decided_by=$4, decided_at=now(), updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, status, remarks ?? null, decidedBy ?? null],
  );
  return rows[0] ?? null;
}

export async function markSubmitted(id) {
  await query(
    `UPDATE kyc_applications SET status='submitted', submitted_at=now(), updated_at=now() WHERE id=$1`,
    [id],
  );
}

export async function list({ status, kind, clientRef, limit, offset }) {
  const where = [];
  const params = [limit, offset];
  for (const [col, val] of [['status', status], ['kind', kind], ['client_ref', clientRef]]) {
    if (val) {
      params.push(val);
      where.push(`${col} = $${params.length}`);
    }
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, kind, source, client_ref, full_name, pan, status, created_at, submitted_at
       FROM kyc_applications ${clause} ORDER BY id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}

/* ── Checks ───────────────────────────────────────────────────────────────── */

/** Upsert a check result for (application, type). */
export async function upsertCheck(applicationId, type, result) {
  const { rows } = await query(
    `INSERT INTO kyc_checks (application_id, type, status, provider, reference, detail, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (application_id, type) DO UPDATE
       SET status=EXCLUDED.status, provider=EXCLUDED.provider, reference=EXCLUDED.reference,
           detail=EXCLUDED.detail, verified_at=EXCLUDED.verified_at, updated_at=now()
     RETURNING *`,
    [
      applicationId,
      type,
      result.status,
      result.provider ?? null,
      result.reference ?? null,
      result.detail ? JSON.stringify(result.detail) : null,
      result.status === 'verified' ? new Date() : null,
    ],
  );
  return rows[0];
}

export async function listChecks(applicationId) {
  const { rows } = await query(
    `SELECT type, status, provider, reference, detail, verified_at
       FROM kyc_checks WHERE application_id=$1 ORDER BY type`,
    [applicationId],
  );
  return rows;
}

/* ── Documents ────────────────────────────────────────────────────────────── */

export async function addDocument(doc) {
  const { rows } = await query(
    `INSERT INTO kyc_documents (application_id, type, storage_ref, content_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, type, content_type, size_bytes, uploaded_at`,
    [doc.applicationId, doc.type, doc.storageRef, doc.contentType ?? null, doc.size ?? null, doc.uploadedBy ?? null],
  );
  return rows[0];
}

export async function listDocuments(applicationId) {
  const { rows } = await query(
    `SELECT id, type, content_type, size_bytes, uploaded_at FROM kyc_documents WHERE application_id=$1`,
    [applicationId],
  );
  return rows;
}

export { withTransaction };
