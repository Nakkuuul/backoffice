/**
 * Base class for known/operational errors that the app intentionally throws.
 * The global error handler uses `isOperational` to decide whether to expose
 * the message to the client vs. returning a generic 500.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, { code, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', opts) {
    super(message, 400, { code: 'BAD_REQUEST', ...opts });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', opts) {
    super(message, 401, { code: 'UNAUTHORIZED', ...opts });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', opts) {
    super(message, 403, { code: 'FORBIDDEN', ...opts });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', opts) {
    super(message, 404, { code: 'NOT_FOUND', ...opts });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', opts) {
    super(message, 409, { code: 'CONFLICT', ...opts });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', opts) {
    super(message, 429, { code: 'TOO_MANY_REQUESTS', ...opts });
  }
}
