import Joi from 'joi';
import { NATURES } from './accounting.constants.js';

export const createGroupSchema = Joi.object({
  name: Joi.string().trim().max(128).required(),
  parentId: Joi.number().integer().positive(),
  // Required only for a primary group (no parent); inherited otherwise.
  nature: Joi.string().valid(...NATURES),
});

export const updateGroupSchema = Joi.object({
  name: Joi.string().trim().max(128),
  parentId: Joi.number().integer().positive(),
}).min(1);

export const createLedgerSchema = Joi.object({
  name: Joi.string().trim().max(128).required(),
  groupId: Joi.number().integer().positive().required(),
  alias: Joi.string().trim().max(128),
  openingBalance: Joi.number().precision(2).default(0),
  openingBalanceType: Joi.string().valid('Dr', 'Cr').default('Dr'),
  clientRef: Joi.string().max(128),
  notes: Joi.string().max(1000),
});

export const updateLedgerSchema = Joi.object({
  name: Joi.string().trim().max(128),
  groupId: Joi.number().integer().positive(),
  alias: Joi.string().trim().max(128).allow(''),
  openingBalance: Joi.number().precision(2),
  openingBalanceType: Joi.string().valid('Dr', 'Cr'),
  clientRef: Joi.string().max(128).allow(''),
  notes: Joi.string().max(1000).allow(''),
}).min(1);

export const listLedgersSchema = Joi.object({
  groupId: Joi.number().integer().positive(),
  clientRef: Joi.string().max(128),
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
