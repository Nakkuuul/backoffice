import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError.js';
import { hasPermission } from '../../modules/user-service/rbac.js';

const SUPER_ADMIN = 'super_admin';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * decoded payload to `req.user` ({ id, role, type, clientRef }).
 */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
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
