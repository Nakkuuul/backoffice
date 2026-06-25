import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './esign.controller.js';
import { signSchema, listSchema, idParamSchema, pinSchema } from './esign.validation.js';

/**
 * eSign routes — sign PDFs with the physical DSC token (PAdES) and track
 * every request for audit. All routes require authentication.
 *
 * Layered pattern:
 *   routes → controller → service → { signer (PKCS#11), ports (docs/email), repository }
 */
const router = Router();

router.use(authenticate);

// Token / certificate diagnostics.
router.get('/status', requirePermission('esign:read'), asyncHandler(controller.status));
router.get('/certificate', requirePermission('esign:read'), asyncHandler(controller.certificate));

// DSC PIN configuration (sensitive — esign:config, reserved to super_admin).
// Stored encrypted; never returned.
router.post('/config/pin', requirePermission('esign:config'), validate(pinSchema), asyncHandler(controller.setPin));
router.get('/config/pin', requirePermission('esign:config'), asyncHandler(controller.pinStatus));
router.delete('/config/pin', requirePermission('esign:config'), asyncHandler(controller.deletePin));

// Signing + history.
router.post('/sign', requirePermission('esign:sign'), validate(signSchema), asyncHandler(controller.sign));
router.get('/requests', requirePermission('esign:read'), validate(listSchema, 'query'), asyncHandler(controller.list));
router.get(
  '/requests/:id',
  requirePermission('esign:read'),
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getOne),
);

export default router;
