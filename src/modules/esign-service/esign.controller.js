import { NotFoundError } from '../../shared/errors/AppError.js';
import * as service from './esign.service.js';

/** GET /esign/status — DSC token availability (no signing). */
export async function status(_req, res) {
  res.json(await service.getSignerStatus());
}

/** GET /esign/certificate — signing certificate on the token. */
export async function certificate(_req, res) {
  res.json(await service.getSignerCertificate());
}

/** POST /esign/sign — sign a document and optionally email it. */
export async function sign(req, res) {
  const result = await service.signDocument(req.body, {
    requestedBy: req.user?.id,
  });
  res.status(201).json({
    request: result.request,
    // Inline result so callers can use the signed PDF immediately.
    signedBase64: result.signedBase64,
  });
}

/** POST /esign/config/pin — store DSC PIN (encrypted). */
export async function setPin(req, res) {
  await service.setDscPin(req.body.pin, { userId: req.user?.id });
  res.status(204).end();
}

/** GET /esign/config/pin — whether a PIN is configured (never returns it). */
export async function pinStatus(_req, res) {
  res.json(await service.getPinStatus());
}

/** DELETE /esign/config/pin — remove stored PIN. */
export async function deletePin(_req, res) {
  await service.clearDscPin();
  res.status(204).end();
}

/** GET /esign/requests — list signing requests. */
export async function list(req, res) {
  const items = await service.listRequests(req.query);
  res.json({ items, count: items.length });
}

/** GET /esign/requests/:id — single request with audit-relevant fields. */
export async function getOne(req, res) {
  const row = await service.getRequest(req.params.id);
  if (!row) throw new NotFoundError(`eSign request ${req.params.id} not found`);
  res.json(row);
}
