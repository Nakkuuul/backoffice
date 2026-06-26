import { BadRequestError } from '../../shared/errors/AppError.js';

/**
 * Validate a request segment against a Zod schema. On success, req[property] is
 * replaced with the parsed value (coerced, defaults applied, unknown keys
 * stripped — Zod objects strip by default). On failure → 400 with per-issue
 * messages.
 *
 *   router.post('/', validate(schema, 'body'), handler);
 *   router.get('/', validate(listSchema, 'query'), handler);
 */
export const validate =
  (schema, property = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      return next(
        new BadRequestError('Validation failed', {
          details: result.error.issues.map((i) =>
            i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message,
          ),
        }),
      );
    }
    req[property] = result.data;
    next();
  };
