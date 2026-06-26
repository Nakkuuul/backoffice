import Joi from 'joi';
import { ROLE_NAMES } from '../../shared/rbac.js';

export const updateUserSchema = Joi.object({
  fullName: Joi.string().max(160),
  role: Joi.string().valid(...ROLE_NAMES),
  phone: Joi.string().max(32),
  isActive: Joi.boolean(),
  clientRef: Joi.string().max(128),
}).min(1);

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
