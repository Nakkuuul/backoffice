import { query } from '../../db/pool.js';

/* ── Groups ───────────────────────────────────────────────────────────────── */

export async function createGroup(g) {
  const { rows } = await query(
    `INSERT INTO acc_groups (name, parent_id, nature, is_primary, is_system)
     VALUES ($1,$2,$3,$4,false) RETURNING *`,
    [g.name, g.parentId ?? null, g.nature, g.isPrimary ?? false],
  );
  return rows[0];
}

export async function findGroupById(id) {
  const { rows } = await query(`SELECT * FROM acc_groups WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function findGroupByName(name) {
  const { rows } = await query(`SELECT * FROM acc_groups WHERE lower(name)=lower($1)`, [name]);
  return rows[0] ?? null;
}

export async function listGroups() {
  const { rows } = await query(
    `SELECT g.*, (SELECT count(*) FROM acc_ledgers l WHERE l.group_id = g.id)::int AS ledger_count
       FROM acc_groups g ORDER BY g.is_primary DESC, g.name`,
  );
  return rows;
}

export async function updateGroup(id, fields) {
  const allowed = { name: 'name', parentId: 'parent_id', nature: 'nature' };
  const sets = [];
  const values = [];
  for (const [k, col] of Object.entries(allowed)) {
    if (fields[k] !== undefined) {
      values.push(fields[k]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (!sets.length) return findGroupById(id);
  sets.push('updated_at = now()');
  values.push(id);
  const { rows } = await query(
    `UPDATE acc_groups SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function groupChildCount(id) {
  const { rows } = await query(
    `SELECT (SELECT count(*) FROM acc_groups WHERE parent_id=$1)::int AS groups,
            (SELECT count(*) FROM acc_ledgers WHERE group_id=$1)::int AS ledgers`,
    [id],
  );
  return rows[0];
}

export async function deleteGroup(id) {
  await query(`DELETE FROM acc_groups WHERE id=$1`, [id]);
}

/* ── Ledgers ──────────────────────────────────────────────────────────────── */

export async function createLedger(l) {
  const { rows } = await query(
    `INSERT INTO acc_ledgers (name, group_id, alias, opening_balance, opening_balance_type, client_ref, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      l.name,
      l.groupId,
      l.alias ?? null,
      l.openingBalance ?? 0,
      l.openingBalanceType ?? 'Dr',
      l.clientRef ?? null,
      l.notes ?? null,
    ],
  );
  return rows[0];
}

export async function findLedgerById(id) {
  const { rows } = await query(
    `SELECT l.*, g.name AS group_name, g.nature
       FROM acc_ledgers l JOIN acc_groups g ON g.id = l.group_id WHERE l.id=$1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findLedgerByName(name) {
  const { rows } = await query(`SELECT * FROM acc_ledgers WHERE lower(name)=lower($1)`, [name]);
  return rows[0] ?? null;
}

export async function listLedgers({ groupId, clientRef, limit, offset }) {
  const where = [];
  const params = [limit, offset];
  if (groupId) {
    params.push(groupId);
    where.push(`l.group_id = $${params.length}`);
  }
  if (clientRef) {
    params.push(clientRef);
    where.push(`l.client_ref = $${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT l.id, l.name, l.group_id, g.name AS group_name, l.opening_balance,
            l.opening_balance_type, l.client_ref, l.created_at
       FROM acc_ledgers l JOIN acc_groups g ON g.id = l.group_id
       ${clause} ORDER BY l.name LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}

export async function updateLedger(id, fields) {
  const allowed = {
    name: 'name',
    groupId: 'group_id',
    alias: 'alias',
    openingBalance: 'opening_balance',
    openingBalanceType: 'opening_balance_type',
    clientRef: 'client_ref',
    notes: 'notes',
  };
  const sets = [];
  const values = [];
  for (const [k, col] of Object.entries(allowed)) {
    if (fields[k] !== undefined) {
      values.push(fields[k]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (!sets.length) return findLedgerById(id);
  sets.push('updated_at = now()');
  values.push(id);
  const { rows } = await query(
    `UPDATE acc_ledgers SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteLedger(id) {
  await query(`DELETE FROM acc_ledgers WHERE id=$1`, [id]);
}

/** All ledgers with their group + nature, for building financial statements. */
export async function ledgerBalances() {
  const { rows } = await query(
    `SELECT l.id, l.name, l.group_id, g.nature,
            l.opening_balance, l.opening_balance_type
       FROM acc_ledgers l JOIN acc_groups g ON g.id = l.group_id
       ORDER BY l.name`,
  );
  return rows;
}
