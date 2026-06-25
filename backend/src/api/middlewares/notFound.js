import { NotFoundError } from '../../shared/errors/AppError.js';

/** Catch-all for unmatched routes — forwards a 404 to the error handler. */
export function notFound(req, _res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}
