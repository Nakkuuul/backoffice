import express, { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import { config } from '../../config/index.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import * as controller from './ekyc.controller.js';
import {
  createApplicationSchema,
  intakeSchema,
  updateApplicationSchema,
  runCheckSchema,
  decideSchema,
  attachDocSchema,
  listSchema,
  idParamSchema,
} from './ekyc.validation.js';

/** Verify the frontoffice's shared secret for the intake webhook (no JWT). */
function intakeSecret(req, _res, next) {
  const token = req.get('x-frontoffice-token');
  if (!config.ekyc.intakeSecret || token !== config.ekyc.intakeSecret) {
    return next(new UnauthorizedError('Invalid frontoffice token'));
  }
  next();
}

const router = Router();

// Frontoffice intake — secret-authenticated (machine-to-machine), before JWT.
router.post(
  '/intake',
  intakeSecret,
  express.json({ limit: '1mb' }),
  validate(intakeSchema),
  asyncHandler(controller.intake),
);

// Everything below requires a backoffice login.
router.use(authenticate);

router.post('/', requirePermission('kyc:manage'), validate(createApplicationSchema), asyncHandler(controller.create));
router.get('/', requirePermission('kyc:read'), validate(listSchema, 'query'), asyncHandler(controller.list));
router.get('/:id', requirePermission('kyc:read'), validate(idParamSchema, 'params'), asyncHandler(controller.getOne));
router.patch('/:id', requirePermission('kyc:manage'), validate(idParamSchema, 'params'), validate(updateApplicationSchema), asyncHandler(controller.update));
router.post('/:id/submit', requirePermission('kyc:manage'), validate(idParamSchema, 'params'), asyncHandler(controller.submit));
router.post('/:id/checks', requirePermission('kyc:verify'), validate(idParamSchema, 'params'), validate(runCheckSchema), asyncHandler(controller.runCheck));
router.post('/:id/documents', requirePermission('kyc:manage'), validate(idParamSchema, 'params'), validate(attachDocSchema), asyncHandler(controller.attachDocument));
router.post('/:id/decision', requirePermission('kyc:verify'), validate(idParamSchema, 'params'), validate(decideSchema), asyncHandler(controller.decide));

export default router;
