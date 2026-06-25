import Joi from 'joi';

/**
 * POST /esign/sign
 * Two input shapes:
 *   - inline: provide base64 PDF directly (handy now, before documents module)
 *   - reference: provide documentRef to be fetched from the documents module
 * Optionally provide `deliver` to email the signed PDF via the email module.
 */
export const signSchema = Joi.object({
  // Exactly one source must be present.
  documentRef: Joi.string().trim().max(255),
  documentBase64: Joi.string().base64(),

  documentName: Joi.string().trim().max(255).required(),

  // Optional signature appearance overrides.
  reason: Joi.string().trim().max(255),
  location: Joi.string().trim().max(255),
  contactInfo: Joi.string().trim().max(255),

  // Optional delivery instruction handed to the email module.
  deliver: Joi.object({
    to: Joi.array().items(Joi.string().email()).min(1).required(),
    subject: Joi.string().trim().max(255).required(),
    body: Joi.string().max(10_000),
  }),
})
  .xor('documentRef', 'documentBase64')
  .messages({ 'object.xor': 'Provide exactly one of documentRef or documentBase64' });

/** GET /esign/requests query params. */
export const listSchema = Joi.object({
  status: Joi.string().valid('pending', 'signing', 'signed', 'sent', 'failed'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

/** :id path param. */
export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

/** POST /esign/config/pin — store the DSC PIN (encrypted at rest). */
export const pinSchema = Joi.object({
  pin: Joi.string().min(4).max(64).required(),
});
