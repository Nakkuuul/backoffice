import { z } from 'zod';
import { KYC_KINDS, CHECK_TYPES, DOC_TYPES } from './ekyc.constants.js';

const jsonObject = z.record(z.string(), z.unknown());
const pan = z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, 'invalid PAN format');
const mobile = z.string().regex(/^[0-9]{10}$/, 'mobile must be 10 digits');
const aadhaarLast4 = z.string().regex(/^[0-9]{4}$/, 'aadhaarLast4 must be 4 digits');

const applicant = {
  kind: z.enum(KYC_KINDS).default('ekyc'),
  clientRef: z.string().min(1).max(128).optional(),
  fullName: z.string().trim().min(1).max(160),
  email: z.email().optional(),
  mobile: mobile.optional(),
  pan: pan.optional(),
  aadhaarLast4: aadhaarLast4.optional(),
  changes: jsonObject.optional(),
};

export const createApplicationSchema = z.object({ ...applicant });

/** Frontoffice push — adds externalRef for idempotency. */
export const intakeSchema = z.object({
  ...applicant,
  externalRef: z.string().min(1).max(160).optional(),
});

export const updateApplicationSchema = z
  .object({
    clientRef: z.string().max(128).optional(), // allow('')
    fullName: z.string().trim().min(1).max(160).optional(),
    email: z.union([z.email(), z.literal('')]).optional(), // allow('')
    mobile: mobile.optional(),
    pan: pan.optional(),
    aadhaarLast4: aadhaarLast4.optional(),
    changes: jsonObject.optional(),
    remarks: z.string().max(1000).optional(), // allow('')
    assignedTo: z.coerce.number().int().positive().optional(),
  })
  .refine((o) => Object.keys(o).length >= 1, { message: 'Provide at least one field to update' });

export const runCheckSchema = z.object({
  type: z.enum(CHECK_TYPES),
  payload: jsonObject.default({}),
});

export const decideSchema = z.object({
  decision: z.enum(['approve', 'reject', 'hold']),
  remarks: z.string().min(1).max(1000).optional(),
});

export const attachDocSchema = z.object({
  type: z.enum(DOC_TYPES),
  contentBase64: z.base64(),
  contentType: z.string().min(1).max(128).optional(),
});

export const listSchema = z.object({
  status: z.enum(['draft', 'submitted', 'in_review', 'approved', 'rejected', 'on_hold']).optional(),
  kind: z.enum(KYC_KINDS).optional(),
  clientRef: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
