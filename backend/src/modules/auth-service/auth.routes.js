import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import {
  loginLimiter,
  twoFactorLimiter,
  passwordChangeLimiter,
} from '../../api/middlewares/rateLimit.js';
import * as controller from './auth.controller.js';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
  twoFactorCodeSchema,
  registerSchema,
} from './auth.validation.js';

/**
 * auth-service routes — `/api/v1/auth`. Authentication + registration.
 *
 * Multi-step login: login → (change-password if forced) → (2fa enroll or verify)
 * → full tokens. login/refresh are public; the step-up routes accept the interim
 * "challenge" token and are the only routes reachable while a step is pending
 * (see the gate in authenticate). register is admin-gated.
 */
const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/logout', authenticate, validate(logoutSchema), asyncHandler(controller.logout));
router.post(
  '/change-password',
  authenticate,
  passwordChangeLimiter,
  validate(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

// Two-factor (TOTP). setup/enable run during first-login enrollment; verify on
// returning logins. All require a token (interim challenge token is sufficient)
// and are rate-limited per user to bound brute-force / secret-churn.
router.post('/2fa/setup', authenticate, twoFactorLimiter, asyncHandler(controller.twoFactorSetup));
router.post('/2fa/enable', authenticate, twoFactorLimiter, validate(twoFactorCodeSchema), asyncHandler(controller.twoFactorEnable));
router.post('/2fa/verify', authenticate, twoFactorLimiter, validate(twoFactorCodeSchema), asyncHandler(controller.twoFactorVerify));

router.post(
  '/register',
  authenticate,
  requirePermission('users:manage'),
  validate(registerSchema),
  asyncHandler(controller.register),
);

export default router;
