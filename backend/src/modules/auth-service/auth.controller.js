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

/** POST /auth/change-password → fresh { token, refreshToken, user, permissions }. */
export async function changePassword(req, res) {
  res.json(await service.changePassword(req.user.id, req.body, ctxOf(req)));
}

/** POST /auth/register — admin/master creates a user (forced first-login reset). */
export async function register(req, res) {
  res.status(201).json(
    await service.register(req.body, { createdBy: req.user.id, actorRole: req.user.role }),
  );
}
