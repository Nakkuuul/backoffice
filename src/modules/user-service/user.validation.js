import Joi from 'joi';
import { ROLE_NAMES } from './rbac.js';

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).max(256).required(),
});

export const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(256).required(),
  fullName: Joi.string().max(160).required(),
  role: Joi.string()
    .valid(...ROLE_NAMES)
    .required(),
  clientRef: Joi.string().max(128), // required for client role (checked in service)
  phone: Joi.string().max(32),
});

export const updateUserSchema = Joi.object({
  fullName: Joi.string().max(160),
  role: Joi.string().valid(...ROLE_NAMES),
  phone: Joi.string().max(32),
  isActive: Joi.boolean(),
  clientRef: Joi.string().max(128),
}).min(1);

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(256).required(),
  newPassword: Joi.string().min(8).max(256).required(),
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(256).required(),
});

export const listSchema = Joi.object({
  userType: Joi.string().valid('broker', 'client'),
  role: Joi.string().valid(...ROLE_NAMES),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

export const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
