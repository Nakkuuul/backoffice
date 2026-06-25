import { NotFoundError } from '../../shared/errors/AppError.js';
import * as service from './document.service.js';

function maybeDownload(res, result, body) {
  if (body.download) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.name}"`);
    return res.send(result.buffer);
  }
  const { buffer, ...meta } = result; // eslint-disable-line no-unused-vars
  return res.status(201).json(meta);
}

/** POST /documents/compress */
export async function compress(req, res) {
  const result = await service.compress(req.body, { requestedBy: req.user?.id });
  maybeDownload(res, result, req.body);
}

/** POST /documents/lock */
export async function lock(req, res) {
  const result = await service.lock(req.body, { requestedBy: req.user?.id });
  maybeDownload(res, result, req.body);
}

/** POST /documents/unlock */
export async function unlock(req, res) {
  const result = await service.unlock(req.body, { requestedBy: req.user?.id });
  maybeDownload(res, result, req.body);
}

/** GET /documents/health — qpdf availability/version. */
export async function health(_req, res) {
  res.json(await service.health());
}

/** GET /documents — list. */
export async function list(req, res) {
  const items = await service.listDocuments(req.query);
  res.json({ items, count: items.length });
}

/** GET /documents/:id */
export async function getOne(req, res) {
  const row = await service.getDocument(req.params.id);
  if (!row) throw new NotFoundError(`Document ${req.params.id} not found`);
  res.json(row);
}

/** GET /documents/:id/download */
export async function download(req, res) {
  const file = await service.getFile(req.params.id);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
}
