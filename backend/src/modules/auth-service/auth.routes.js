import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './auth.controller.js';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
  registerSchema,
} from './auth.validation.js';

/**
 * auth-service routes — `/api/v1/auth`. Authentication + registration.
 *
 * login/refresh are public; me/logout/change-password require a token (and are
 * the only routes reachable while a forced password change is pending — see the
 * mcp gate in authenticate). register is admin-gated.
 */
const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/logout', authenticate, validate(logoutSchema), asyncHandler(controller.logout));
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(controller.changePassword),
);
router.post(
  '/register',
  authenticate,
  requirePermission('users:manage'),
  validate(registerSchema),
  asyncHandler(controller.register),
);

export default router;
