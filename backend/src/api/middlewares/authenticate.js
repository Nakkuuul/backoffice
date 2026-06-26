import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError.js';
import { hasPermission } from '../../shared/rbac.js';

const SUPER_ADMIN = 'super_admin';

// Endpoints reachable with an interim "login challenge" token, scoped to the
// EXACT pending stage so a later stage can't reach an earlier one's endpoint
// (e.g. a verify_2fa token must NOT be able to /2fa/setup and overwrite the
// enrolled secret). Paths are RELATIVE to the auth router mount and matched
// exactly (no substring/suffix games).
const ALWAYS_ALLOWED = ['/me', '/logout'];
const STAGE_ALLOWED = {
  change_password: [...ALWAYS_ALLOWED, '/change-password'],
  enroll_2fa: [...ALWAYS_ALLOWED, '/2fa/setup', '/2fa/enable'],
  verify_2fa: [...ALWAYS_ALLOWED, '/2fa/verify'],
};

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the decoded
 * payload to `req.user` ({ id, role, type, clientRef, pre?, need?, mcp? }).
 *
 * Interim tokens (`pre: true`, also legacy `mcp: true`) are restricted to ONLY
 * the endpoint(s) of their current step: a pending password change → the
 * change-password flow (403 PASSWORD_CHANGE_REQUIRED); a pending 2FA step → only
 * that 2FA endpoint (403 TWO_FACTOR_REQUIRED). Everything else is blocked until
 * login fully completes.
 */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  let payload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret);
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
  req.user = payload;

  if (payload.pre || payload.mcp) {
    // mcp implies the password-change stage regardless of `need`.
    const stage = payload.mcp ? 'change_password' : payload.need;
    const allowed = STAGE_ALLOWED[stage] ?? ALWAYS_ALLOWED;
    // Exact match on the auth-router-relative path (req.path excludes the query
    // string and is relative to the mount), and only within the auth router —
    // no substring/suffix matching, so nothing can be smuggled in.
    const onAuthRouter = req.baseUrl.endsWith('/auth');
    const ok = onAuthRouter && allowed.includes(req.path);
    if (!ok) {
      return next(
        stage === 'change_password'
          ? new ForbiddenError('Password change required before continuing', {
              code: 'PASSWORD_CHANGE_REQUIRED',
            })
          : new ForbiddenError('Two-factor authentication required before continuing', {
              code: 'TWO_FACTOR_REQUIRED',
            }),
      );
    }
  }
  next();
}

/** Role-based guard. super_admin always passes. Use after `authenticate`. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new ForbiddenError('Insufficient permissions'));
    if (req.user.role === SUPER_ADMIN) return next();
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };

/**
 * Permission-based guard (RBAC). Requires the user's role to grant ALL listed
 * permissions. This is the preferred guard going forward.
 *   router.post('/', requirePermission('reports:generate'), handler)
 */
export const requirePermission =
  (...permissions) =>
  (req, _res, next) => {
    if (!req.user) return next(new ForbiddenError('Insufficient permissions'));
    const ok = permissions.every((p) => hasPermission(req.user.role, p));
    if (!ok) {
      return next(new ForbiddenError(`Missing permission: ${permissions.join(', ')}`));
    }
    next();
  };
