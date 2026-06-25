import { query, withTransaction } from '../../db/pool.js';

/** Insert a report job row (pending). Returns the row. */
export async function insert(job) {
  const { rows } = await query(
    `INSERT INTO reports
       (report_type, format, client_ref, params, title, status, source_module, requested_by)
     VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
     RETURNING *`,
    [
      job.reportType,
      job.format,
      job.clientRef ?? null,
      job.params ? JSON.stringify(job.params) : null,
      job.title ?? null,
      job.sourceModule ?? null,
      job.requestedBy ?? null,
    ],
  );
  return rows[0];
}

/** Bulk insert many pending jobs (one per client/format). Returns count. */
export async function insertMany(jobs) {
  if (jobs.length === 0) return 0;
  return withTransaction(async (client) => {
    let n = 0;
    for (const job of jobs) {
      await client.query(
        `INSERT INTO reports (report_type, format, client_ref, params, title, status, source_module, requested_by)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)`,
        [
          job.reportType,
          job.format,
          job.clientRef ?? null,
          job.params ? JSON.stringify(job.params) : null,
          job.title ?? null,
          job.sourceModule ?? null,
          job.requestedBy ?? null,
        ],
      );
      n++;
    }
    return n;
  });
}

export async function markGenerating(id) {
  await query(`UPDATE reports SET status='generating', updated_at=now() WHERE id=$1`, [id]).catch(
    () => {},
  );
}

export async function markReady(id, out) {
  await query(
    `UPDATE reports
       SET status='ready', storage_ref=$2, filename=$3, content_type=$4,
           content_sha256=$5, size_bytes=$6, generated_at=now(), locked_by=NULL, locked_at=NULL
     WHERE id=$1`,
    [id, out.storageRef, out.filename, out.contentType, out.sha256, out.size],
  );
}

export async function markFailed(id, error, { attempts, maxAttempts }) {
  const dead = attempts >= maxAttempts;
  await query(
    `UPDATE reports
       SET status=$2, error=$3, locked_by=NULL, locked_at=NULL,
           next_attempt_at = now() + interval '30 seconds'
     WHERE id=$1`,
    [id, dead ? 'failed' : 'pending', error],
  );
}

/** Claim a batch of pending jobs for a worker (no double-processing). */
export async function claimBatch(workerId, limit) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM reports
         WHERE status='pending' AND next_attempt_at <= now()
         ORDER BY id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1`,
      [limit],
    );
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const { rows: claimed } = await client.query(
      `UPDATE reports
         SET status='generating', locked_by=$1, locked_at=now(), attempts=attempts+1, updated_at=now()
       WHERE id = ANY($2::bigint[])
       RETURNING *`,
      [workerId, ids],
    );
    return claimed;
  });
}

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM reports WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function list({ status, reportType, limit, offset }) {
  const where = [];
  const params = [limit, offset];
  if (status) {
    params.push(status);
    where.push(`status=$${params.length}`);
  }
  if (reportType) {
    params.push(reportType);
    where.push(`report_type=$${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, report_type, format, client_ref, status, filename, size_bytes, created_at, generated_at, error
       FROM reports ${clause} ORDER BY id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}
