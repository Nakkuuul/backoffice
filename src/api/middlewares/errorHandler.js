import { AppError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Global error-handling middleware. Must be registered LAST.
 * Operational (known) errors expose their message; everything else is masked.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isOperational = err instanceof AppError && err.isOperational;
  const statusCode = isOperational ? err.statusCode : 500;

  if (!isOperational) {
    logger.error({ err, path: req.path }, 'Unhandled error');
  } else {
    logger.warn({ code: err.code, path: req.path }, err.message);
  }

  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isOperational ? err.message : 'Internal server error',
      ...(err.details ? { details: err.details } : {}),
      ...(config.isProd ? {} : { stack: err.stack }),
    },
  });
}
