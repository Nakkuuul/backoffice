import { query } from '../../db/pool.js';

export async function insert(doc) {
  const { rows } = await query(
    `INSERT INTO documents
       (name, operation, parent_id, storage_ref, content_type, size_bytes,
        content_sha256, encrypted, meta, source_module, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      doc.name,
      doc.operation,
      doc.parentId ?? null,
      doc.storageRef,
      doc.contentType ?? 'application/pdf',
      doc.size ?? null,
      doc.sha256 ?? null,
      doc.encrypted ?? false,
      doc.meta ? JSON.stringify(doc.meta) : null,
      doc.sourceModule ?? null,
      doc.requestedBy ?? null,
    ],
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM documents WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function list({ operation, limit, offset }) {
  const where = operation ? `WHERE operation=$3` : '';
  const params = operation ? [limit, offset, operation] : [limit, offset];
  const { rows } = await query(
    `SELECT id, name, operation, parent_id, size_bytes, encrypted, created_at
       FROM documents ${where} ORDER BY id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}
