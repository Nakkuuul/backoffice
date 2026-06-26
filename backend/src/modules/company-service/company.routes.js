import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './company.controller.js';
import {
  updateCompanySchema,
  membershipCreateSchema,
  membershipUpdateSchema,
  idParamSchema,
} from './company.validation.js';

/**
 * company-service — `/api/v1/company`. The broker's own entity profile (singleton)
 * + structured exchange memberships. Read is broad (company:read); edits require
 * company:manage.
 */
const router = Router();

// Public branding for the login screen — no auth, brand-safe fields only.
router.get('/public', asyncHandler(controller.getPublicBranding));

router.use(authenticate);

router.get('/', requirePermission('company:read'), asyncHandler(controller.getCompany));
router.put('/', requirePermission('company:manage'), validate(updateCompanySchema), asyncHandler(controller.updateCompany));

router.post(
  '/memberships',
  requirePermission('company:manage'),
  validate(membershipCreateSchema),
  asyncHandler(controller.addMembership),
);
router.patch(
  '/memberships/:id',
  requirePermission('company:manage'),
  validate(idParamSchema, 'params'),
  validate(membershipUpdateSchema),
  asyncHandler(controller.updateMembership),
);
router.delete(
  '/memberships/:id',
  requirePermission('company:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(controller.removeMembership),
);

export default router;
