import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { liveness, readiness } from './health.controller.js';

const router = Router();

router.get('/live', liveness);
router.get('/ready', asyncHandler(readiness));

export default router;
