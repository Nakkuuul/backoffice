import { z } from 'zod';

/**
 * POST /esign/sign
 * Two input shapes:
 *   - inline: provide base64 PDF directly (handy now, before documents module)
 *   - reference: provide documentRef to be fetched from the documents module
 * Optionally provide `deliver` to email the signed PDF via the email module.
 */
export const signSchema = z
  .object({
    // Exactly one source must be present (enforced by the refine below).
    documentRef: z.string().trim().min(1).max(255).optional(),
    documentBase64: z.base64().optional(),

    documentName: z.string().trim().min(1).max(255),

    // Optional signature appearance overrides.
    reason: z.string().trim().min(1).max(255).optional(),
    location: z.string().trim().min(1).max(255).optional(),
    contactInfo: z.string().trim().min(1).max(255).optional(),

    // Optional delivery instruction handed to the email module.
    deliver: z
      .object({
        to: z.array(z.email()).min(1),
        subject: z.string().trim().min(1).max(255),
        body: z.string().min(1).max(10_000).optional(),
      })
      .optional(),
  })
  .refine((o) => Boolean(o.documentRef) !== Boolean(o.documentBase64), {
    message: 'Provide exactly one of documentRef or documentBase64',
  });

/** GET /esign/requests query params. */
export const listSchema = z.object({
  status: z.enum(['pending', 'signing', 'signed', 'sent', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** :id path param. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** POST /esign/config/pin — store the DSC PIN (encrypted at rest). */
export const pinSchema = z.object({
  pin: z.string().min(4).max(64),
});
