import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../shared/errors/AppError.js';
import { ROLES, USER_TYPE, isValidRole, effectivePermissions } from '../../shared/rbac.js';
import * as users from '../user-service/user.repository.js';
import * as sessions from './auth.repository.js';
import * as totp from './totp.js';

const BCRYPT_ROUNDS = 10;

// A VALID bcrypt hash used when the user is missing, so the password compare
// costs the same as a real one — defeats timing-based user enumeration.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-timing-guard', BCRYPT_ROUNDS);

function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    userType: row.user_type,
    clientRef: row.client_ref,
    phone: row.phone,
    isActive: row.is_active,
    mustChangePassword: Boolean(row.must_change_password),
    twoFactorEnabled: Boolean(row.totp_enabled),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

/** Full access JWT (issued only once login is fully complete). */
function issueAccessToken(row) {
  return jwt.sign(
    {
      id: Number(row.id),
      role: row.role,
      type: row.user_type,
      clientRef: row.client_ref ?? null,
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.accessTtl },
  );
}

/**
 * Interim "login challenge" token — carries `pre: true` plus the pending step.
 * The authenticate gate restricts it to the step-up endpoints only. No refresh
 * session is created until login fully completes.
 */
function issueInterimToken(row, need) {
  return jwt.sign(
    {
      id: Number(row.id),
      role: row.role,
      type: row.user_type,
      clientRef: row.client_ref ?? null,
      pre: true,
      need,
      mcp: need === 'change_password',
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.challengeTtl },
  );
}

/** Tiny TTL parser: '30d' | '15m' | '1h' | '90s' → milliseconds. */
function ttlMs(ttl) {
  const m = String(ttl).match(/^(\d+)\s*([smhd])?$/);
  if (!m) return 30 * 86400 * 1000;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2] || 's'];
  return Number(m[1]) * mult;
}

/** Open a refresh-token session and return the raw token. */
async function startSession(row, ctx = {}) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs(config.auth.refreshTtl));
  await sessions.createSession({
    userId: row.id,
    refreshToken,
    expiresAt,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });
  return refreshToken;
}

/**
 * The next step a user must complete before they are fully logged in:
 * password change first, then 2FA (enroll if not set up, else verify).
 */
function nextNeed(row) {
  if (row.must_change_password) return 'change_password';
  if (config.auth.twoFactor.enabled && !row.totp_enabled) return 'enroll_2fa';
  if (config.auth.twoFactor.enabled && row.totp_enabled) return 'verify_2fa';
  return 'none';
}

/** Response for a pending step: interim token + what the client must do next. */
function challengeResult(row, need) {
  return {
    stage: need,
    token: issueInterimToken(row, need),
    mustChangePassword: need === 'change_password',
    twoFactorEnrolled: Boolean(row.totp_enabled),
    twoFactorRequired: config.auth.twoFactor.enabled,
  };
}

/** Final response: create the session and issue the real access+refresh pair. */
async function fullResult(row, ctx = {}) {
  const refreshToken = await startSession(row, ctx);
  return {
    stage: 'authenticated',
    token: issueAccessToken(row),
    refreshToken,
    user: publicUser(row),
    permissions: effectivePermissions(row.role),
    mustChangePassword: false,
  };
}

/**
 * Step 1 — authenticate by email + password. Returns either a fully-authenticated
 * result (when nothing else is pending) or a challenge (change_password /
 * enroll_2fa / verify_2fa) with a short-lived interim token.
 */
export async function login({ email, password }, ctx = {}) {
  const row = await users.findByEmail(email);
  // Constant-ish work even when the user is missing, to dampen enumeration/timing.
  const hash = row?.password_hash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) throw new UnauthorizedError('Invalid email or password');
  if (!row.is_active) throw new UnauthorizedError('Account is disabled');

  await users.touchLogin(row.id);
  const need = nextNeed(row);
  return need === 'none' ? fullResult(row, ctx) : challengeResult(row, need);
}

/** Rotate a refresh token → new access + refresh (atomic, replay-safe). */
export async function refresh({ refreshToken }, ctx = {}) {
  const session = await sessions.claimSession(refreshToken);
  if (!session) throw new UnauthorizedError('Invalid or expired refresh token');
  const row = await users.findFullById(session.user_id);
  if (!row || !row.is_active) throw new UnauthorizedError('Account is disabled');

  const newRefresh = await startSession(row, ctx);
  return { stage: 'authenticated', token: issueAccessToken(row), refreshToken: newRefresh };
}

/**
 * Logout. With a refresh token → revoke that one session. Without → revoke ALL
 * of the user's sessions ("sign out everywhere").
 */
export async function logout(userId, { refreshToken } = {}) {
  if (refreshToken) await sessions.revokeSession(refreshToken);
  else if (userId) await sessions.revokeAllForUser(userId);
}

/** Current user + effective permissions (drives the UI). */
export async function me(userId) {
  const row = await users.findById(userId);
  if (!row) throw new NotFoundError('User not found');
  return { user: publicUser(row), permissions: effectivePermissions(row.role) };
}

/**
 * Self-service password change. Clears must_change_password and revokes ALL
 * prior sessions. When part of the login flow (`fromLoginFlow`), advances to the
 * next step (2FA enroll/verify) with a new interim token; otherwise (routine
 * change by an already-authenticated user) issues a fresh full token pair.
 */
export async function changePassword(userId, { currentPassword, newPassword }, ctx = {}, opts = {}) {
  const row = await users.findFullById(userId);
  if (!row) throw new NotFoundError('User not found');
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');
  if (newPassword === currentPassword) {
    throw new BadRequestError('New password must differ from the current password');
  }

  await users.setPassword(userId, await bcrypt.hash(newPassword, BCRYPT_ROUNDS), false);
  await sessions.revokeAllForUser(userId);

  const fresh = await users.findFullById(userId);
  if (opts.fromLoginFlow) {
    const need = nextNeed(fresh);
    return need === 'none' ? fullResult(fresh, ctx) : challengeResult(fresh, need);
  }
  return fullResult(fresh, ctx); // routine change (already passed 2FA this session)
}

/* ── Two-factor authentication (TOTP) ─────────────────────────────────────────── */

function assertTwoFactorReady(row) {
  if (!config.auth.twoFactor.enabled) throw new BadRequestError('Two-factor authentication is disabled');
  if (row.must_change_password) {
    throw new ForbiddenError('Change your password before setting up two-factor authentication', {
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}

/**
 * Begin 2FA enrollment: generate a pending secret, return the QR + otpauth URI
 * (and the base32 secret for manual entry). Not active until confirmed.
 */
export async function setupTwoFactor(userId) {
  const row = await users.findFullById(userId);
  if (!row) throw new NotFoundError('User not found');
  assertTwoFactorReady(row);
  // Never silently replace an active secret — that would be a 2FA bypass. A
  // device change goes through admin reset-2fa (or a future verified reset).
  if (row.totp_enabled) throw new BadRequestError('Two-factor authentication is already enabled');

  const secret = totp.generateSecret();
  await users.setTotpSecret(userId, totp.packSecret(secret));
  const otpauthUrl = totp.otpauthUrl(row.email, secret);
  const qrCode = await totp.qrDataUrl(otpauthUrl);
  return { qrCode, otpauthUrl, secret };
}

/**
 * Confirm enrollment with a code from the app → enable 2FA, issue recovery
 * codes (shown once), and complete login (full tokens).
 */
export async function enableTwoFactor(userId, code, ctx = {}) {
  const row = await users.findFullById(userId);
  if (!row) throw new NotFoundError('User not found');
  assertTwoFactorReady(row);
  if (row.totp_enabled) throw new BadRequestError('Two-factor authentication is already enabled');

  const secret = totp.unpackSecret(row.totp_secret_enc);
  if (!secret) throw new BadRequestError('Start two-factor setup first');
  if (!totp.verifyTotp(secret, code)) throw new UnauthorizedError('Invalid authenticator code');

  await users.enableTotp(userId);
  const recoveryCodes = totp.generateRecoveryCodes();
  await sessions.replaceRecoveryCodes(userId, recoveryCodes.map(totp.hashRecoveryCode));

  const fresh = await users.findFullById(userId);
  return { ...(await fullResult(fresh, ctx)), recoveryCodes };
}

/**
 * Step 2 (returning logins) — verify a TOTP code (or a one-time recovery code)
 * → complete login (full tokens).
 */
export async function verifyTwoFactor(userId, code, ctx = {}) {
  const row = await users.findFullById(userId);
  if (!row) throw new NotFoundError('User not found');
  if (!config.auth.twoFactor.enabled || !row.totp_enabled) {
    throw new BadRequestError('Two-factor authentication is not enabled');
  }

  const secret = totp.unpackSecret(row.totp_secret_enc);
  let ok = totp.verifyTotp(secret, code);
  if (!ok) ok = await sessions.consumeRecoveryCode(userId, totp.hashRecoveryCode(code));
  if (!ok) throw new UnauthorizedError('Invalid authenticator code');

  return fullResult(row, ctx);
}

/**
 * Register (create) a user — admin/master initiated. The new user gets the
 * given temporary password with must_change_password=true, so their first
 * login forces a reset (and then 2FA enrollment).
 */
export async function register(input, { createdBy, actorRole } = {}) {
  if (!isValidRole(input.role)) throw new BadRequestError(`Unknown role: ${input.role}`);
  // Privilege guard: only a super_admin may create another super_admin. (Skipped
  // for trusted internal callers — CLI/bootstrap — which pass no actorRole.)
  if (input.role === 'super_admin' && actorRole && actorRole !== 'super_admin') {
    throw new ForbiddenError('Only a super_admin can create a super_admin');
  }
  const userType = ROLES[input.role].type;
  if (userType === USER_TYPE.CLIENT && !input.clientRef) {
    throw new BadRequestError('clientRef is required for client users');
  }
  if (await users.findByEmail(input.email)) {
    throw new ConflictError('A user with that email already exists');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const row = await users.create({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    userType,
    clientRef: input.clientRef,
    phone: input.phone,
    createdBy,
    mustChangePassword: true,
  });
  return publicUser(row);
}

/**
 * Seed the master super_admin on first boot (idempotent). Created with
 * must_change_password=true so the very first login forces a password reset
 * (then 2FA enrollment).
 */
export async function ensureMaster() {
  const supers = await users.list({ role: 'super_admin', limit: 1, offset: 0 });
  if (supers.length > 0) return { created: false, reason: 'super_admin exists' };
  if (await users.findByEmail(config.auth.master.email)) {
    return { created: false, reason: 'email exists' };
  }
  const passwordHash = await bcrypt.hash(config.auth.master.password, BCRYPT_ROUNDS);
  const row = await users.create({
    email: config.auth.master.email,
    passwordHash,
    fullName: config.auth.master.name,
    role: 'super_admin',
    userType: USER_TYPE.BROKER,
    mustChangePassword: true,
  });
  return { created: true, email: row.email };
}
