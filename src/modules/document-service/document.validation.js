import Joi from 'joi';

// Every op takes input as inline base64 OR an existing document id.
const inputSource = {
  documentBase64: Joi.string().base64(),
  documentId: Joi.number().integer().positive(),
  name: Joi.string().max(255),
  download: Joi.boolean().default(false),
};

export const compressSchema = Joi.object({ ...inputSource })
  .or('documentBase64', 'documentId')
  .messages({ 'object.missing': 'Provide documentBase64 or documentId' });

export const lockSchema = Joi.object({
  ...inputSource,
  userPassword: Joi.string().max(256).allow(''),
  ownerPassword: Joi.string().max(256).allow(''),
})
  .or('documentBase64', 'documentId')
  .or('userPassword', 'ownerPassword')
  .messages({ 'object.missing': 'Provide a source and at least one password' });

export const unlockSchema = Joi.object({
  ...inputSource,
  password: Joi.string().max(256).required(),
}).or('documentBase64', 'documentId');

export const listSchema = Joi.object({
  operation: Joi.string().valid('upload', 'compress', 'lock', 'unlock'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

export const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
