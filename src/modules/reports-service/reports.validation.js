import Joi from 'joi';

/** POST /reports/generate — on-demand single report. */
export const generateSchema = Joi.object({
  reportType: Joi.string().max(64).required(),
  format: Joi.string().valid('pdf', 'csv', 'xlsx', 'html').required(),
  params: Joi.object().default({}),
  // If true, return the file inline; else return the job record (id) only.
  download: Joi.boolean().default(true),
});

/** POST /reports/bulk — enqueue many jobs. */
export const bulkSchema = Joi.object({
  reportType: Joi.string().max(64).required(),
  format: Joi.string().valid('pdf', 'csv', 'xlsx', 'html').required(),
  items: Joi.array()
    .items(Joi.object({ clientRef: Joi.string().max(128).required(), params: Joi.object() }))
    .min(1)
    .max(100000)
    .required(),
});

export const listSchema = Joi.object({
  status: Joi.string().valid('pending', 'generating', 'ready', 'failed'),
  reportType: Joi.string().max(64),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

export const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
