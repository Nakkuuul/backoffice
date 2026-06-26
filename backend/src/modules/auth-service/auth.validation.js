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

// "Forgot access" — request a reset via a chosen channel. Always returns a
// uniform response (no account-existence disclosure).
export const forgotPasswordSchema = z.object({
  email: z.email(),
  method: z.enum(['email_link', 'email_otp', 'sms_otp']).optional(),
});

// Complete a reset with EITHER a link token OR (email + 6-digit OTP).
export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(256).optional(),
    email: z.email().optional(),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits').optional(),
    newPassword: z.string().min(8).max(256),
  })
  .refine((d) => Boolean(d.token) || Boolean(d.email && d.otp), {
    message: 'Provide a reset token, or an email and OTP code',
  });

export const verifyResetSchema = z.object({
  token: z.string().min(20).max(256),
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(256),
  fullName: z.string().min(1).max(160),
  role: z.enum(ROLE_NAMES),
  clientRef: z.string().min(1).max(128).optional(), // required for client roles (checked in service)
  phone: z.string().min(1).max(32).optional(),
});
