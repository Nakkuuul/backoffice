import * as service from './user.service.js';

/* ── Auth ─────────────────────────────────────────────────────────────────── */

/** POST /auth/login */
export async function login(req, res) {
  res.json(await service.login(req.body));
}

/** GET /auth/me — current user + effective permissions (drives the UI). */
export async function me(req, res) {
  res.json(await service.me(req.user.id));
}

/** POST /auth/change-password */
export async function changePassword(req, res) {
  await service.changePassword(req.user.id, req.body);
  res.status(204).end();
}

/* ── User management (admin) ──────────────────────────────────────────────── */

/** GET /users/roles — RBAC catalog for the frontend. */
export function roles(_req, res) {
  res.json({ roles: service.roles() });
}

/** POST /users */
export async function create(req, res) {
  const user = await service.createUser(req.body, { createdBy: req.user.id });
  res.status(201).json(user);
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
  res.json(await service.updateUser(req.params.id, req.body));
}

/** POST /users/:id/reset-password */
export async function resetPassword(req, res) {
  await service.resetPassword(req.params.id, req.body.newPassword);
  res.status(204).end();
}
