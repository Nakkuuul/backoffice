/**
 * Wraps an async Express route handler so rejected promises are forwarded
 * to the error-handling middleware instead of crashing the process.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
