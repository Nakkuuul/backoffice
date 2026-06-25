import express, { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, authorize } from '../../api/middlewares/authenticate.js';
import { config } from '../../config/index.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import * as controller from './email.controller.js';
import { sendSchema, listSchema, idParamSchema, suppressionSchema } from './email.validation.js';

/** Verify the MTA's shared secret for the inbound webhook (no JWT). */
function inboundSecret(req, _res, next) {
  const token = req.get('x-inbound-token');
  if (!config.email.inboundSecret || token !== config.email.inboundSecret) {
    return next(new UnauthorizedError('Invalid inbound token'));
  }
  next();
}

/**
 * email-service routes. All require authentication. Sending an email enqueues
 * it into the durable outbox; a worker fleet performs delivery.
 *
 * Layered pattern:
 *   routes → controller → service → { repository (outbox), transport (SMTP), templates }
 *   worker → repository + transport (out-of-band delivery)
 */
const router = Router();

// Inbound webhook from the MTA — secret-authenticated (NOT JWT), raw body.
// Declared before the JWT guard so it bypasses user auth.
router.post(
  '/inbound',
  inboundSecret,
  express.text({ type: () => true, limit: '30mb' }),
  asyncHandler(controller.inbound),
);

router.use(authenticate);

router.get('/health', asyncHandler(controller.health));

router.post('/send', validate(sendSchema), asyncHandler(controller.send));
router.get('/messages', validate(listSchema, 'query'), asyncHandler(controller.list));
router.get('/messages/:id', validate(idParamSchema, 'params'), asyncHandler(controller.getOne));

// Suppression list management (admin).
router.post('/suppressions', authorize('admin'), validate(suppressionSchema), asyncHandler(controller.addSuppression));
router.delete('/suppressions/:address', authorize('admin'), asyncHandler(controller.removeSuppression));

export default router;
