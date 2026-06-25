import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, authorize } from '../../api/middlewares/authenticate.js';
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
router.get('/status', asyncHandler(controller.status));
router.get('/certificate', asyncHandler(controller.certificate));

// DSC PIN configuration (admin only). Stored encrypted; never returned.
router.post('/config/pin', authorize('admin'), validate(pinSchema), asyncHandler(controller.setPin));
router.get('/config/pin', authorize('admin'), asyncHandler(controller.pinStatus));
router.delete('/config/pin', authorize('admin'), asyncHandler(controller.deletePin));

// Signing + history.
router.post('/sign', validate(signSchema), asyncHandler(controller.sign));
router.get('/requests', validate(listSchema, 'query'), asyncHandler(controller.list));
router.get(
  '/requests/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getOne),
);

export default router;
