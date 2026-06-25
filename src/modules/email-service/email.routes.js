import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, authorize } from '../../api/middlewares/authenticate.js';
import * as controller from './email.controller.js';
import { sendSchema, listSchema, idParamSchema, suppressionSchema } from './email.validation.js';

/**
 * email-service routes. All require authentication. Sending an email enqueues
 * it into the durable outbox; a worker fleet performs delivery.
 *
 * Layered pattern:
 *   routes → controller → service → { repository (outbox), transport (SMTP), templates }
 *   worker → repository + transport (out-of-band delivery)
 */
const router = Router();

router.use(authenticate);

router.get('/health', asyncHandler(controller.health));

router.post('/send', validate(sendSchema), asyncHandler(controller.send));
router.get('/messages', validate(listSchema, 'query'), asyncHandler(controller.list));
router.get('/messages/:id', validate(idParamSchema, 'params'), asyncHandler(controller.getOne));

// Suppression list management (admin).
router.post('/suppressions', authorize('admin'), validate(suppressionSchema), asyncHandler(controller.addSuppression));
router.delete('/suppressions/:address', authorize('admin'), asyncHandler(controller.removeSuppression));

export default router;
