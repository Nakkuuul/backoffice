import { z } from 'zod';
import { ROLE_NAMES } from '../../shared/rbac.js';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16).max(256),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(16).max(256).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

// 6-digit TOTP code or a recovery code (e.g. "A1B2C-D3E4F").
export const twoFactorCodeSchema = z.object({
  code: z.string().min(6).max(20),
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(256),
  fullName: z.string().min(1).max(160),
  role: z.enum(ROLE_NAMES),
  clientRef: z.string().min(1).max(128).optional(), // required for client roles (checked in service)
  phone: z.string().min(1).max(32).optional(),
});
