import { z } from 'zod';
import { NATURES } from './accounting.constants.js';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(128),
  parentId: z.coerce.number().int().positive().optional(),
  // Required only for a primary group (no parent); inherited otherwise.
  nature: z.enum(NATURES).optional(),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    parentId: z.coerce.number().int().positive().optional(),
  })
  .refine((o) => Object.keys(o).length >= 1, { message: 'Provide at least one field to update' });

export const createLedgerSchema = z.object({
  name: z.string().trim().min(1).max(128),
  groupId: z.coerce.number().int().positive(),
  alias: z.string().trim().min(1).max(128).optional(),
  openingBalance: z.coerce.number().default(0),
  openingBalanceType: z.enum(['Dr', 'Cr']).default('Dr'),
  clientRef: z.string().min(1).max(128).optional(),
  notes: z.string().min(1).max(1000).optional(),
});

export const updateLedgerSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    groupId: z.coerce.number().int().positive().optional(),
    alias: z.string().trim().max(128).optional(), // allow('')
    openingBalance: z.coerce.number().optional(),
    openingBalanceType: z.enum(['Dr', 'Cr']).optional(),
    clientRef: z.string().max(128).optional(), // allow('')
    notes: z.string().max(1000).optional(), // allow('')
  })
  .refine((o) => Object.keys(o).length >= 1, { message: 'Provide at least one field to update' });

export const listLedgersSchema = z.object({
  groupId: z.coerce.number().int().positive().optional(),
  clientRef: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
