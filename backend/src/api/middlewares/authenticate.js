import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError.js';
import { hasPermission } from '../../shared/rbac.js';

const SUPER_ADMIN = 'super_admin';

// Endpoints a user with a pending forced password change may still reach
// (so they can complete the reset, read their own state, or log out).
const PWD_CHANGE_EXEMPT = ['/auth/change-password', '/auth/me', '/auth/logout'];

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the decoded
 * payload to `req.user` ({ id, role, type, clientRef, mcp }). When the token
 * carries `mcp` (must-change-password), all routes are blocked with a clear
 * 403 PASSWORD_CHANGE_REQUIRED except the password-change flow.
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

  if (payload.mcp) {
    // Match on the PATH ONLY (strip query string) with an exact suffix check,
    // so an exempt path can't be smuggled via `?x=/auth/me` (substring bypass).
    const path = req.originalUrl.split('?')[0];
    const exempt = PWD_CHANGE_EXEMPT.some((p) => path === p || path.endsWith(p));
    if (!exempt) {
      return next(
        new ForbiddenError('Password change required before continuing', {
          code: 'PASSWORD_CHANGE_REQUIRED',
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
