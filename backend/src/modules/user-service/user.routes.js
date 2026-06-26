import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './user.controller.js';
import { updateUserSchema, resetPasswordSchema, listSchema, idParamSchema } from './user.validation.js';

/**
 * User administration — `/api/v1/users`. RBAC-guarded by users:read /
 * users:manage. Authentication + registration (create) live in auth-service.
 */
export const userRoutes = Router();
userRoutes.use(authenticate);

// Role catalog for the frontend.
userRoutes.get('/roles', requirePermission('users:read'), controller.roles);

userRoutes.get('/', requirePermission('users:read'), validate(listSchema, 'query'), asyncHandler(controller.list));
userRoutes.get('/:id', requirePermission('users:read'), validate(idParamSchema, 'params'), asyncHandler(controller.getOne));
userRoutes.patch('/:id', requirePermission('users:manage'), validate(idParamSchema, 'params'), validate(updateUserSchema), asyncHandler(controller.update));
userRoutes.post(
  '/:id/reset-password',
  requirePermission('users:manage'),
  validate(idParamSchema, 'params'),
  validate(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);
userRoutes.post(
  '/:id/reset-2fa',
  requirePermission('users:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(controller.resetTwoFactor),
);
