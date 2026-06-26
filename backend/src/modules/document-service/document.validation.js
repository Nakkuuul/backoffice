import { z } from 'zod';

// Every op takes input as inline base64 OR an existing document id.
const inputSource = {
  documentBase64: z.base64().optional(),
  documentId: z.coerce.number().int().positive().optional(),
  name: z.string().min(1).max(255).optional(),
  download: z.boolean().default(false),
};

const hasSource = (o) => o.documentBase64 !== undefined || o.documentId !== undefined;

export const compressSchema = z
  .object({ ...inputSource })
  .refine(hasSource, { message: 'Provide documentBase64 or documentId' });

export const lockSchema = z
  .object({
    ...inputSource,
    userPassword: z.string().max(256).optional(), // allow('') → empty permitted
    ownerPassword: z.string().max(256).optional(),
  })
  .refine(hasSource, { message: 'Provide documentBase64 or documentId' })
  .refine((o) => o.userPassword !== undefined || o.ownerPassword !== undefined, {
    message: 'Provide at least one password',
  });

export const unlockSchema = z
  .object({ ...inputSource, password: z.string().min(1).max(256) })
  .refine(hasSource, { message: 'Provide documentBase64 or documentId' });

export const listSchema = z.object({
  operation: z.enum(['upload', 'compress', 'lock', 'unlock']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
