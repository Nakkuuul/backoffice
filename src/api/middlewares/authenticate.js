import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError.js';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * decoded payload to `req.user`.
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

/** Role-based guard. Use after `authenticate`. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || (roles.length && !roles.includes(req.user.role))) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
