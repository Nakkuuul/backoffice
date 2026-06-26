/**
 * HTTP verification of the forced-password-change gate (server must be running):
 *   register (admin) → login (mcp) → protected route 403 PASSWORD_CHANGE_REQUIRED
 *   → change-password → protected route now 200.  node scripts/test-auth-http.mjs
 */
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config/index.js';

const base = `http://localhost:${config.app.port}/api/v1`;
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

const { rows } = await pool.query(`SELECT id FROM users WHERE role='super_admin' ORDER BY id LIMIT 1`);
const adminId = Number(rows[0].id);
const superTok = jwt.sign({ id: adminId, role: 'super_admin', type: 'broker' }, config.auth.jwtSecret, { expiresIn: '5m' });

const api = async (method, path, token, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
};

const ts = Date.now();
const email = `http${ts}@example.com`;
const temp = 'TempPass#9';
const neo = 'FreshPass#9999';

try {
  const reg = await api('POST', '/auth/register', superTok, { email, password: temp, fullName: 'HTTP User', role: 'operations' });
  check('register (admin) → 201', reg.status === 201 && reg.json.mustChangePassword === true);

  const login = await api('POST', '/auth/login', null, { email, password: temp });
  check('login → mustChangePassword + access + refresh', login.status === 200 && login.json.mustChangePassword === true && !!login.json.token && !!login.json.refreshToken);
  const tok = login.json.token;

  const gated = await api('GET', '/reports?limit=1', tok);
  check('gate: protected route blocked', gated.status === 403 && gated.json?.error?.code === 'PASSWORD_CHANGE_REQUIRED', `${gated.status} ${gated.json?.error?.code}`);

  // The gate must NOT be bypassable by smuggling an exempt path into the query.
  const bypass = await api('GET', '/reports?x=/auth/me&y=/auth/change-password', tok);
  check('gate: query-string bypass blocked', bypass.status === 403 && bypass.json?.error?.code === 'PASSWORD_CHANGE_REQUIRED', `${bypass.status} ${bypass.json?.error?.code}`);

  const meR = await api('GET', '/auth/me', tok);
  check('gate: /auth/me still allowed', meR.status === 200);

  const cp = await api('POST', '/auth/change-password', tok, { currentPassword: temp, newPassword: neo });
  check('change-password → 200, mcp cleared, fresh tokens', cp.status === 200 && cp.json.mustChangePassword === false && !!cp.json.token);
  const tok2 = cp.json.token;

  const ok = await api('GET', '/reports?limit=1', tok2);
  check('post-change: protected route now allowed', ok.status === 200);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
} finally {
  await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
  await pool.end();
}
