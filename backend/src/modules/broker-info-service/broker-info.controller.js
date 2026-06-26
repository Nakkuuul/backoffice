import * as service from './broker-info.service.js';

/** GET /company → { profile, memberships, activeSegments } */
export async function getCompany(_req, res) {
  res.json(await service.getCompany());
}

/** GET /company/public → brand-safe fields, no auth (login screen / tab title). */
export async function getPublicBranding(_req, res) {
  res.json(await service.getPublicBranding());
}

/** PUT /company — update the singleton profile. */
export async function updateCompany(req, res) {
  res.json(await service.updateCompany(req.body, { updatedBy: req.user.id }));
}

/** POST /company/memberships */
export async function addMembership(req, res) {
  res.status(201).json(await service.addMembership(req.body));
}

/** PATCH /company/memberships/:id */
export async function updateMembership(req, res) {
  res.json(await service.updateMembership(req.params.id, req.body));
}

/** DELETE /company/memberships/:id */
export async function removeMembership(req, res) {
  await service.removeMembership(req.params.id);
  res.status(204).end();
}
