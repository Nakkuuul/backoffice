import { NotFoundError } from '../../shared/errors/AppError.js';
import * as service from './email.service.js';
import { processInbound } from './email.inbound.js';

/** POST /email/inbound — raw message forwarded from the MTA (machine-to-machine). */
export async function inbound(req, res) {
  const result = await processInbound(req.body);
  res.status(202).json(result);
}

/** POST /email/send — enqueue an email for delivery. */
export async function send(req, res) {
  const body = req.body;
  // Decode base64 attachment content to Buffers at the edge.
  const attachments = (body.attachments ?? []).map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    content: a.contentBase64 ? Buffer.from(a.contentBase64, 'base64') : undefined,
    storageRef: a.storageRef,
  }));

  const result = await service.enqueue({ ...body, attachments });
  res.status(202).json(result); // 202 Accepted — queued, not yet delivered
}

/** GET /email/messages — list outbox messages. */
export async function list(req, res) {
  const items = await service.listMessages(req.query);
  res.json({ items, count: items.length });
}

/** GET /email/messages/:id */
export async function getOne(req, res) {
  const row = await service.getMessage(req.params.id);
  if (!row) throw new NotFoundError(`Email message ${req.params.id} not found`);
  res.json(row);
}

/** GET /email/health — relay reachability + outbox status counts. */
export async function health(_req, res) {
  res.json(await service.health());
}

/** POST /email/suppressions — add an address to the suppression list. */
export async function addSuppression(req, res) {
  await service.suppress(req.body.address, req.body.reason, req.body.detail);
  res.status(204).end();
}

/** DELETE /email/suppressions/:address */
export async function removeSuppression(req, res) {
  await service.unsuppress(req.params.address);
  res.status(204).end();
}
