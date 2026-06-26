import bcrypt from 'bcryptjs';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import * as repo from './user.repository.js';
import { isValidRole, roleCatalog } from '../../shared/rbac.js';

// Administration of existing users. Authentication + registration live in
// auth-service; this module reads/updates user records and exposes the RBAC
// catalog for the UI.

const BCRYPT_ROUNDS = 10;
const SUPER_ADMIN = 'super_admin';

/**
 * Privilege guard for actions targeting a specific user. `actor` is req.user
 * (absent for trusted internal callers). Rules:
 *  - non-super_admin may NOT act on a super_admin (can't touch higher privilege);
 *  - only super_admin may assign the super_admin role (no escalation);
 *  - nobody may change their OWN role / active status here (anti-lockout/escalation).
 */
function assertCanManage(actor, targetRow, fields = {}) {
  if (!actor) return; // trusted (CLI / internal)
  const actorIsSuper = actor.role === SUPER_ADMIN;
  if (targetRow.role === SUPER_ADMIN && !actorIsSuper) {
    throw new ForbiddenError('Cannot modify a super_admin');
  }
  if (fields.role === SUPER_ADMIN && !actorIsSuper) {
    throw new ForbiddenError('Only a super_admin can assign the super_admin role');
  }
  if (
    Number(actor.id) === Number(targetRow.id) &&
    (fields.role !== undefined || fields.isActive !== undefined)
  ) {
    throw new ForbiddenError('You cannot change your own role or active status');
  }
}

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
    mustChangePassword: row.must_change_password ?? false,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export async function updateUser(id, fields, actor) {
  if (fields.role !== undefined && !isValidRole(fields.role)) {
    throw new BadRequestError(`Unknown role: ${fields.role}`);
  }
  const current = await repo.findById(id);
  if (!current) throw new NotFoundError('User not found');
  assertCanManage(actor, current, fields);

  // Client users must always keep a clientRef (matches the register invariant).
  const effectiveRole = fields.role ?? current.role;
  if (effectiveRole === 'client') {
    const effectiveRef = fields.clientRef !== undefined ? fields.clientRef : current.client_ref;
    if (!effectiveRef) throw new BadRequestError('clientRef is required for client users');
  }

  const row = await repo.update(id, fields);
  return publicUser(row);
}

/** Admin password reset — forces a change on the user's next login. */
export async function resetPassword(id, newPassword, actor) {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError('User not found');
  assertCanManage(actor, row);
  await repo.setPassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS), true);
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
