import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './reports.controller.js';
import { generateSchema, bulkSchema, listSchema, idParamSchema } from './reports.validation.js';

/**
 * reports-service routes (all require auth).
 *
 * Layered pattern:
 *   routes → controller → service → { registry (definitions), renderers (pdf/csv/xlsx/html),
 *                                     storage (disk), repository (registry/queue) }
 *   worker → repository + service (bulk generation, out of band)
 */
const router = Router();

router.use(authenticate);

router.get('/types', requirePermission('reports:read'), controller.types);
router.post('/generate', requirePermission('reports:generate'), validate(generateSchema), asyncHandler(controller.generate));
router.post('/bulk', requirePermission('reports:bulk'), validate(bulkSchema), asyncHandler(controller.bulk));
router.get('/', requirePermission('reports:read'), validate(listSchema, 'query'), asyncHandler(controller.list));
router.get('/:id', requirePermission('reports:read'), validate(idParamSchema, 'params'), asyncHandler(controller.getOne));
router.get('/:id/download', requirePermission('reports:read'), validate(idParamSchema, 'params'), asyncHandler(controller.download));

export default router;
