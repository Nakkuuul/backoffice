import * as service from './user.service.js';

// User administration. Authentication + registration are in auth-service.

/** GET /users/roles — RBAC catalog for the frontend. */
export function roles(_req, res) {
  res.json({ roles: service.roles() });
}

/** GET /users */
export async function list(req, res) {
  const items = await service.listUsers(req.query);
  res.json({ items, count: items.length });
}

/** GET /users/:id */
export async function getOne(req, res) {
  res.json(await service.getUser(req.params.id));
}

/** PATCH /users/:id */
export async function update(req, res) {
  res.json(await service.updateUser(req.params.id, req.body, req.user));
}

/** POST /users/:id/reset-password — admin reset (forces change on next login). */
export async function resetPassword(req, res) {
  await service.resetPassword(req.params.id, req.body.newPassword, req.user);
  res.status(204).end();
}
