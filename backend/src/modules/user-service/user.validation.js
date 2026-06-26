import { z } from 'zod';
import { ROLE_NAMES } from '../../shared/rbac.js';

export const updateUserSchema = z
  .object({
    fullName: z.string().min(1).max(160).optional(),
    role: z.enum(ROLE_NAMES).optional(),
    phone: z.string().min(1).max(32).optional(),
    isActive: z.boolean().optional(),
    clientRef: z.string().min(1).max(128).optional(),
  })
  .refine((o) => Object.keys(o).length >= 1, { message: 'Provide at least one field to update' });

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(256),
});

export const listSchema = z.object({
  userType: z.enum(['broker', 'client']).optional(),
  role: z.enum(ROLE_NAMES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
