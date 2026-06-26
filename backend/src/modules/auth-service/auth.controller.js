import * as service from './auth.service.js';

const ctxOf = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

/** POST /auth/login → { token, refreshToken, user, permissions, mustChangePassword } */
export async function login(req, res) {
  res.json(await service.login(req.body, ctxOf(req)));
}

/** POST /auth/refresh → { token, refreshToken, mustChangePassword } */
export async function refresh(req, res) {
  res.json(await service.refresh(req.body, ctxOf(req)));
}

/** POST /auth/logout — revoke the supplied refresh session (or all if none given). */
export async function logout(req, res) {
  await service.logout(req.user.id, req.body);
  res.status(204).end();
}

/** GET /auth/me → { user, permissions } */
export async function me(req, res) {
  res.json(await service.me(req.user.id));
}

/**
 * POST /auth/change-password. In the login flow (interim token) → advances to
 * the next step (2FA). Routine change (full token) → fresh full tokens.
 */
export async function changePassword(req, res) {
  res.json(
    await service.changePassword(req.user.id, req.body, ctxOf(req), {
      fromLoginFlow: Boolean(req.user.pre),
    }),
  );
}

/** POST /auth/2fa/setup → { qrCode, otpauthUrl, secret } (begin enrollment). */
export async function twoFactorSetup(req, res) {
  res.json(await service.setupTwoFactor(req.user.id));
}

/** POST /auth/2fa/enable → confirm code, enable 2FA, return tokens + recoveryCodes. */
export async function twoFactorEnable(req, res) {
  res.json(await service.enableTwoFactor(req.user.id, req.body.code, ctxOf(req)));
}

/** POST /auth/2fa/verify → verify code (returning login) → full tokens. */
export async function twoFactorVerify(req, res) {
  res.json(await service.verifyTwoFactor(req.user.id, req.body.code, ctxOf(req)));
}

/** POST /auth/register — admin/master creates a user (forced first-login reset). */
export async function register(req, res) {
  res.status(201).json(
    await service.register(req.body, { createdBy: req.user.id, actorRole: req.user.role }),
  );
}
