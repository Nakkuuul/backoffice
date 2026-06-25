import { query } from '../../db/pool.js';

const PUBLIC_COLS = `id, email, full_name, role, user_type, client_ref, phone,
  is_active, last_login_at, created_at`;

export async function findByEmail(email) {
  const { rows } = await query(`SELECT * FROM users WHERE lower(email) = lower($1)`, [email]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Full row incl. password_hash (for password verification). */
export async function findFullById(id) {
  const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function create(user) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, role, user_type, client_ref, phone, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${PUBLIC_COLS}`,
    [
      user.email.toLowerCase(),
      user.passwordHash,
      user.fullName ?? null,
      user.role,
      user.userType,
      user.clientRef ?? null,
      user.phone ?? null,
      user.createdBy ?? null,
    ],
  );
  return rows[0];
}

/** Update mutable fields (role, full_name, phone, is_active). */
export async function update(id, fields) {
  const allowed = { fullName: 'full_name', role: 'role', phone: 'phone', isActive: 'is_active', clientRef: 'client_ref' };
  const sets = [];
  const values = [];
  for (const [key, col] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (sets.length === 0) return findById(id);
  sets.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${PUBLIC_COLS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function setPassword(id, passwordHash) {
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
    id,
    passwordHash,
  ]);
}

export async function touchLogin(id) {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [id]);
}

export async function list({ userType, role, limit, offset }) {
  const where = [];
  const params = [limit, offset];
  if (userType) {
    params.push(userType);
    where.push(`user_type = $${params.length}`);
  }
  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${PUBLIC_COLS} FROM users ${clause} ORDER BY id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}
