import Joi from 'joi';
import { KYC_KINDS, CHECK_TYPES, DOC_TYPES } from './ekyc.constants.js';

const pan = Joi.string().pattern(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/).message('invalid PAN format');
const mobile = Joi.string().pattern(/^[0-9]{10}$/).message('mobile must be 10 digits');
const aadhaarLast4 = Joi.string().pattern(/^[0-9]{4}$/).message('aadhaarLast4 must be 4 digits');

const applicant = {
  kind: Joi.string().valid(...KYC_KINDS).default('ekyc'),
  clientRef: Joi.string().max(128),
  fullName: Joi.string().trim().max(160).required(),
  email: Joi.string().email(),
  mobile,
  pan,
  aadhaarLast4,
  changes: Joi.object(),
};

export const createApplicationSchema = Joi.object({ ...applicant });

/** Frontoffice push — adds externalRef for idempotency. */
export const intakeSchema = Joi.object({
  ...applicant,
  externalRef: Joi.string().max(160),
});

export const updateApplicationSchema = Joi.object({
  clientRef: Joi.string().max(128).allow(''),
  fullName: Joi.string().trim().max(160),
  email: Joi.string().email().allow(''),
  mobile,
  pan,
  aadhaarLast4,
  changes: Joi.object(),
  remarks: Joi.string().max(1000).allow(''),
  assignedTo: Joi.number().integer().positive(),
}).min(1);

export const runCheckSchema = Joi.object({
  type: Joi.string().valid(...CHECK_TYPES).required(),
  payload: Joi.object().default({}),
});

export const decideSchema = Joi.object({
  decision: Joi.string().valid('approve', 'reject', 'hold').required(),
  remarks: Joi.string().max(1000),
});

export const attachDocSchema = Joi.object({
  type: Joi.string().valid(...DOC_TYPES).required(),
  contentBase64: Joi.string().base64().required(),
  contentType: Joi.string().max(128),
});

export const listSchema = Joi.object({
  status: Joi.string().valid('draft', 'submitted', 'in_review', 'approved', 'rejected', 'on_hold'),
  kind: Joi.string().valid(...KYC_KINDS),
  clientRef: Joi.string().max(128),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

export const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
