import { BadRequestError } from '../../shared/errors/AppError.js';

/**
 * Validate a request segment against a Joi schema.
 *
 *   router.post('/', validate(schema, 'body'), handler);
 */
export const validate =
  (schema, property = 'body') =>
  (req, _res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return next(
        new BadRequestError('Validation failed', {
          details: error.details.map((d) => d.message),
        }),
      );
    }
    req[property] = value;
    next();
  };
