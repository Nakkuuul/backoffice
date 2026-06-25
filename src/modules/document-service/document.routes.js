import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './document.controller.js';
import {
  compressSchema,
  lockSchema,
  unlockSchema,
  listSchema,
  idParamSchema,
} from './document.validation.js';

/**
 * document-service routes (all require auth). PDF/file operations on bytes
 * supplied inline (base64) or by an existing document id; results are stored
 * in object storage and registered in the documents table.
 */
const router = Router();

router.use(authenticate);

router.get('/health', requirePermission('documents:read'), asyncHandler(controller.health));
router.post('/compress', requirePermission('documents:operate'), validate(compressSchema), asyncHandler(controller.compress));
router.post('/lock', requirePermission('documents:operate'), validate(lockSchema), asyncHandler(controller.lock));
router.post('/unlock', requirePermission('documents:operate'), validate(unlockSchema), asyncHandler(controller.unlock));
router.get('/', requirePermission('documents:read'), validate(listSchema, 'query'), asyncHandler(controller.list));
router.get('/:id', requirePermission('documents:read'), validate(idParamSchema, 'params'), asyncHandler(controller.getOne));
router.get('/:id/download', requirePermission('documents:read'), validate(idParamSchema, 'params'), asyncHandler(controller.download));

export default router;
