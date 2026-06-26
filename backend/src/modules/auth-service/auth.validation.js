import Joi from 'joi';
import { ROLE_NAMES } from '../../shared/rbac.js';

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).max(256).required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().min(16).max(256).required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().min(16).max(256),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(256).required(),
  newPassword: Joi.string().min(8).max(256).required(),
});

// 6-digit TOTP code or a recovery code (e.g. "A1B2C-D3E4F").
export const twoFactorCodeSchema = Joi.object({
  code: Joi.string().min(6).max(20).required(),
});

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(256).required(),
  fullName: Joi.string().max(160).required(),
  role: Joi.string()
    .valid(...ROLE_NAMES)
    .required(),
  clientRef: Joi.string().max(128), // required for client roles (checked in service)
  phone: Joi.string().max(32),
});
