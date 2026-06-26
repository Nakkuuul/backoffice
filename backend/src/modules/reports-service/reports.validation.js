import { z } from 'zod';

const jsonObject = z.record(z.string(), z.unknown());

/** POST /reports/generate — on-demand single report. */
export const generateSchema = z.object({
  reportType: z.string().min(1).max(64),
  format: z.enum(['pdf', 'csv', 'xlsx', 'html']),
  params: jsonObject.default({}),
  // If true, return the file inline; else return the job record (id) only.
  download: z.boolean().default(true),
});

/** POST /reports/bulk — enqueue many jobs. */
export const bulkSchema = z.object({
  reportType: z.string().min(1).max(64),
  format: z.enum(['pdf', 'csv', 'xlsx', 'html']),
  items: z
    .array(z.object({ clientRef: z.string().min(1).max(128), params: jsonObject.optional() }))
    .min(1)
    .max(100000),
});

export const listSchema = z.object({
  status: z.enum(['pending', 'generating', 'ready', 'failed']).optional(),
  reportType: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
