/**
 * HTTP verification of the full multi-step login over the wire (server running):
 *   register(admin) → login(change_password) → gate 403 PASSWORD_CHANGE_REQUIRED
 *   → change-password(enroll_2fa) → gate 403 TWO_FACTOR_REQUIRED → 2fa/setup
 *   → 2fa/enable → protected route 200 → logout → login(verify_2fa)
 *   → 2fa/verify → protected route 200.   node scripts/test-auth-http.mjs
 */
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config/index.js';

const base = `http://localhost:${config.app.port}/api/v1`;
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

const { rows } = await pool.query(`SELECT id FROM users WHERE role='super_admin' ORDER BY id LIMIT 1`);
const superTok = jwt.sign({ id: Number(rows[0].id), role: 'super_admin', type: 'broker' }, config.auth.jwtSecret, { expiresIn: '5m' });

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
const code = (n) => n?.error?.code;

const ts = Date.now();
const email = `http${ts}@example.com`;
const temp = 'TempPass#9';
const neo = 'FreshPass#9999';

try {
  const reg = await api('POST', '/auth/register', superTok, { email, password: temp, fullName: 'HTTP User', role: 'operations' });
  check('register (admin) → 201, mustChangePassword', reg.status === 201 && reg.json.mustChangePassword === true);

  // Step 1: login → change_password challenge.
  const l = await api('POST', '/auth/login', null, { email, password: temp });
  check('login → stage change_password (no refresh)', l.status === 200 && l.json.stage === 'change_password' && !l.json.refreshToken);
  let tok = l.json.token;

  // Gate: password pending → protected route blocked with PASSWORD_CHANGE_REQUIRED.
  const g1 = await api('GET', '/reports?limit=1', tok);
  check('gate: PASSWORD_CHANGE_REQUIRED', g1.status === 403 && code(g1.json) === 'PASSWORD_CHANGE_REQUIRED', `${g1.status} ${code(g1.json)}`);

  // Step 2: change password → enroll_2fa challenge.
  const cp = await api('POST', '/auth/change-password', tok, { currentPassword: temp, newPassword: neo });
  check('change-password → stage enroll_2fa', cp.status === 200 && cp.json.stage === 'enroll_2fa' && !cp.json.refreshToken);
  tok = cp.json.token;

  // Gate: now 2FA pending → protected route blocked with TWO_FACTOR_REQUIRED.
  const g2 = await api('GET', '/reports?limit=1', tok);
  check('gate: TWO_FACTOR_REQUIRED', g2.status === 403 && code(g2.json) === 'TWO_FACTOR_REQUIRED', `${g2.status} ${code(g2.json)}`);
  const g2b = await api('GET', '/reports?x=/auth/2fa/setup', tok);
  check('gate: query-string bypass blocked', g2b.status === 403 && code(g2b.json) === 'TWO_FACTOR_REQUIRED');

  // Step 3a: 2FA setup → QR + secret.
  const setup = await api('POST', '/auth/2fa/setup', tok);
  check('2fa/setup → QR + otpauth + secret', setup.status === 200 && setup.json.qrCode?.startsWith('data:image/png') && !!setup.json.secret);

  // Step 3b: enable with a real code → authenticated + recovery codes.
  const enable = await api('POST', '/auth/2fa/enable', tok, { code: authenticator.generate(setup.json.secret) });
  check('2fa/enable → authenticated + recovery codes', enable.status === 200 && enable.json.stage === 'authenticated' && !!enable.json.refreshToken && Array.isArray(enable.json.recoveryCodes));
  const full = enable.json.token;
  const recovery = enable.json.recoveryCodes?.[0];

  // Protected route now allowed with the full token.
  const ok1 = await api('GET', '/reports?limit=1', full);
  check('post-enroll: protected route allowed', ok1.status === 200);

  // Logout, then a returning login → verify_2fa.
  await api('POST', '/auth/logout', full, { refreshToken: enable.json.refreshToken });
  const l2 = await api('POST', '/auth/login', null, { email, password: neo });
  check('returning login → stage verify_2fa', l2.status === 200 && l2.json.stage === 'verify_2fa' && l2.json.twoFactorEnrolled === true);
  const tok2 = l2.json.token;

  const g3 = await api('GET', '/reports?limit=1', tok2);
  check('gate: verify pending → TWO_FACTOR_REQUIRED', g3.status === 403 && code(g3.json) === 'TWO_FACTOR_REQUIRED');

  // Verify (recovery code path here) → authenticated.
  const v = await api('POST', '/auth/2fa/verify', tok2, { code: recovery });
  check('2fa/verify (recovery code) → authenticated', v.status === 200 && v.json.stage === 'authenticated' && !!v.json.refreshToken);
  const ok2 = await api('GET', '/reports?limit=1', v.json.token);
  check('post-verify: protected route allowed', ok2.status === 200);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
} finally {
  await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
  await pool.end();
}
