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
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

/** Short-lived access JWT. `mcp` = must-change-password (gated by middleware). */
function issueAccessToken(row) {
  return jwt.sign(
    {
      id: Number(row.id),
      role: row.role,
      type: row.user_type,
      clientRef: row.client_ref ?? null,
      mcp: Boolean(row.must_change_password),
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.accessTtl },
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

function authResult(row, refreshToken) {
  return {
    token: issueAccessToken(row),
    refreshToken,
    user: publicUser(row),
    permissions: effectivePermissions(row.role),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

/** Authenticate by email + password → access token + refresh token. */
export async function login({ email, password }, ctx = {}) {
  const row = await users.findByEmail(email);
  // Constant-ish work even when the user is missing, to dampen enumeration/timing.
  const hash = row?.password_hash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) throw new UnauthorizedError('Invalid email or password');
  if (!row.is_active) throw new UnauthorizedError('Account is disabled');

  await users.touchLogin(row.id);
  const refreshToken = await startSession(row, ctx);
  return authResult(row, refreshToken);
}

/** Rotate a refresh token → new access + refresh (atomic, replay-safe). */
export async function refresh({ refreshToken }, ctx = {}) {
  // Atomically consume the old token (revoke + return) so a concurrent replay
  // can't redeem it twice.
  const session = await sessions.claimSession(refreshToken);
  if (!session) throw new UnauthorizedError('Invalid or expired refresh token');
  const row = await users.findFullById(session.user_id);
  if (!row || !row.is_active) throw new UnauthorizedError('Account is disabled');

  const newRefresh = await startSession(row, ctx);
  return {
    token: issueAccessToken(row),
    refreshToken: newRefresh,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

/**
 * Logout. With a refresh token → revoke that one session. Without → revoke ALL
 * of the user's sessions (e.g. "sign out everywhere" / suspected compromise).
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
 * Self-service password change. Clears must_change_password, revokes ALL prior
 * sessions, and issues a fresh access+refresh pair so the caller proceeds
 * seamlessly (e.g. straight after a forced first-login reset).
 */
export async function changePassword(userId, { currentPassword, newPassword }, ctx = {}) {
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
  const refreshToken = await startSession(fresh, ctx);
  return authResult(fresh, refreshToken);
}

/**
 * Register (create) a user — admin/master initiated. The new user gets the
 * given temporary password with must_change_password=true, so their first
 * login forces a reset.
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
 * must_change_password=true so the very first login forces a password reset.
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
