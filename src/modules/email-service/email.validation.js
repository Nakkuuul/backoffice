import Joi from 'joi';

const emailArray = Joi.array().items(Joi.string().email()).min(1);

/** POST /email/send — enqueue an email. */
export const sendSchema = Joi.object({
  to: emailArray.required(),
  cc: Joi.array().items(Joi.string().email()),
  bcc: Joi.array().items(Joi.string().email()),
  replyTo: Joi.string().email(),
  subject: Joi.string().max(255),
  html: Joi.string().max(500_000),
  text: Joi.string().max(500_000),
  template: Joi.string().max(64),
  templateData: Joi.object(),
  priority: Joi.number().integer().min(1).max(9).default(5),
  idempotencyKey: Joi.string().max(255),
  sourceModule: Joi.string().max(64),
  sourceRef: Joi.string().max(255),
  headers: Joi.object().pattern(Joi.string(), Joi.string()),
  attachments: Joi.array().items(
    Joi.object({
      filename: Joi.string().max(255).required(),
      contentBase64: Joi.string().base64(),
      storageRef: Joi.string().max(1024),
      contentType: Joi.string().max(128),
    }).or('contentBase64', 'storageRef'),
  ),
})
  .or('html', 'text', 'template')
  .messages({ 'object.missing': 'Provide one of html, text, or template' });

export const listSchema = Joi.object({
  status: Joi.string().valid('queued', 'sending', 'sent', 'deferred', 'failed', 'suppressed'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

export const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

export const suppressionSchema = Joi.object({
  address: Joi.string().email().required(),
  reason: Joi.string().valid('bounce', 'complaint', 'unsubscribe', 'manual').default('manual'),
  detail: Joi.string().max(1000),
});
