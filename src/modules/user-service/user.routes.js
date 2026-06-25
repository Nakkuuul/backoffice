import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './user.controller.js';
import {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  resetPasswordSchema,
  listSchema,
  idParamSchema,
} from './user.validation.js';

/** Auth endpoints — `/api/v1/auth`. login is public; the rest need a token. */
export const authRoutes = Router();
authRoutes.post('/login', validate(loginSchema), asyncHandler(controller.login));
authRoutes.get('/me', authenticate, asyncHandler(controller.me));
authRoutes.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

/** User management — `/api/v1/users`. RBAC-guarded by users:read / users:manage. */
export const userRoutes = Router();
userRoutes.use(authenticate);

// Role catalog for the frontend (any authenticated staff who can read users).
userRoutes.get('/roles', requirePermission('users:read'), controller.roles);

userRoutes.get('/', requirePermission('users:read'), validate(listSchema, 'query'), asyncHandler(controller.list));
userRoutes.post('/', requirePermission('users:manage'), validate(createUserSchema), asyncHandler(controller.create));
userRoutes.get('/:id', requirePermission('users:read'), validate(idParamSchema, 'params'), asyncHandler(controller.getOne));
userRoutes.patch('/:id', requirePermission('users:manage'), validate(idParamSchema, 'params'), validate(updateUserSchema), asyncHandler(controller.update));
userRoutes.post(
  '/:id/reset-password',
  requirePermission('users:manage'),
  validate(idParamSchema, 'params'),
  validate(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);
