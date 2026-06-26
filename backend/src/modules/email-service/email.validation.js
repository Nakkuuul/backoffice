import { z } from 'zod';

const emailArray = z.array(z.email()).min(1);
const jsonObject = z.record(z.string(), z.unknown());

/** POST /email/send — enqueue an email. */
export const sendSchema = z
  .object({
    to: emailArray,
    cc: z.array(z.email()).optional(),
    bcc: z.array(z.email()).optional(),
    replyTo: z.email().optional(),
    subject: z.string().min(1).max(255).optional(),
    html: z.string().min(1).max(500_000).optional(),
    text: z.string().min(1).max(500_000).optional(),
    template: z.string().min(1).max(64).optional(),
    templateData: jsonObject.optional(),
    priority: z.coerce.number().int().min(1).max(9).default(5),
    idempotencyKey: z.string().min(1).max(255).optional(),
    sourceModule: z.string().min(1).max(64).optional(),
    sourceRef: z.string().min(1).max(255).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    attachments: z
      .array(
        z
          .object({
            filename: z.string().min(1).max(255),
            contentBase64: z.base64().optional(),
            storageRef: z.string().min(1).max(1024).optional(),
            contentType: z.string().min(1).max(128).optional(),
          })
          .refine((a) => a.contentBase64 !== undefined || a.storageRef !== undefined, {
            message: 'attachment requires contentBase64 or storageRef',
          }),
      )
      .optional(),
  })
  .refine((o) => o.html !== undefined || o.text !== undefined || o.template !== undefined, {
    message: 'Provide one of html, text, or template',
  });

export const listSchema = z.object({
  status: z.enum(['queued', 'sending', 'sent', 'deferred', 'failed', 'suppressed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const suppressionSchema = z.object({
  address: z.email(),
  reason: z.enum(['bounce', 'complaint', 'unsubscribe', 'manual']).default('manual'),
  detail: z.string().min(1).max(1000).optional(),
});
