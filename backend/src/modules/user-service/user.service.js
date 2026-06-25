import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '../../shared/errors/AppError.js';
import * as repo from './user.repository.js';
import { ROLES, USER_TYPE, isValidRole, effectivePermissions, roleCatalog } from './rbac.js';

const BCRYPT_ROUNDS = 10;

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    userType: row.user_type,
    clientRef: row.client_ref,
    phone: row.phone,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

/** Issue a signed JWT carrying identity + role (permissions derived per-request). */
function issueToken(row) {
  return jwt.sign(
    { id: Number(row.id), role: row.role, type: row.user_type, clientRef: row.client_ref ?? null },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );
}

/** Authenticate by email + password; returns token + user + permissions. */
export async function login({ email, password }) {
  const row = await repo.findByEmail(email);
  // Constant-ish work even when user missing, to reduce enumeration signal.
  const hash = row?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) throw new UnauthorizedError('Invalid email or password');
  if (!row.is_active) throw new UnauthorizedError('Account is disabled');

  await repo.touchLogin(row.id);
  return {
    token: issueToken(row),
    user: publicUser(row),
    permissions: effectivePermissions(row.role),
  };
}

/** Current user + effective permissions (frontend uses this to drive the UI). */
export async function me(userId) {
  const row = await repo.findById(userId);
  if (!row) throw new NotFoundError('User not found');
  return { user: publicUser(row), permissions: effectivePermissions(row.role) };
}

/** Create a user. Validates role/type consistency. */
export async function createUser(input, { createdBy } = {}) {
  if (!isValidRole(input.role)) throw new BadRequestError(`Unknown role: ${input.role}`);
  const roleDef = ROLES[input.role];
  const userType = roleDef.type;
  if (userType === USER_TYPE.CLIENT && !input.clientRef) {
    throw new BadRequestError('client_ref is required for client users');
  }
  if (await repo.findByEmail(input.email)) {
    throw new ConflictError('A user with that email already exists');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const row = await repo.create({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    userType,
    clientRef: input.clientRef,
    phone: input.phone,
    createdBy,
  });
  return publicUser(row);
}

export async function updateUser(id, fields) {
  if (fields.role !== undefined && !isValidRole(fields.role)) {
    throw new BadRequestError(`Unknown role: ${fields.role}`);
  }
  const row = await repo.update(id, fields);
  if (!row) throw new NotFoundError('User not found');
  return publicUser(row);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const row = await repo.findFullById(userId);
  if (!row) throw new NotFoundError('User not found');
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');
  await repo.setPassword(userId, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}

/** Admin password reset (no current-password check). */
export async function resetPassword(id, newPassword) {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError('User not found');
  await repo.setPassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}

export async function getUser(id) {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError('User not found');
  return publicUser(row);
}

export function listUsers(params) {
  return repo.list(params);
}

export function roles() {
  return roleCatalog();
}
