import { NotFoundError } from '../../shared/errors/AppError.js';
import * as service from './reports.service.js';

/** GET /reports/types — available report definitions. */
export function types(_req, res) {
  res.json({ reports: service.availableReports() });
}

/** POST /reports/generate — generate one report now. */
export async function generate(req, res) {
  const { reportType, format, params, download } = req.body;
  const result = await service.generateNow({ reportType, format, params, requestedBy: req.user?.id });

  if (download) {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }
  res.status(201).json({
    id: result.id,
    filename: result.filename,
    size: result.size,
    storageRef: result.storageRef,
  });
}

/** POST /reports/bulk — enqueue a bulk run. */
export async function bulk(req, res) {
  const result = await service.enqueueBulk({ ...req.body, requestedBy: req.user?.id });
  res.status(202).json(result);
}

/** GET /reports — list report jobs. */
export async function list(req, res) {
  const items = await service.listJobs(req.query);
  res.json({ items, count: items.length });
}

/** GET /reports/:id — job record. */
export async function getOne(req, res) {
  const row = await service.getJob(req.params.id);
  if (!row) throw new NotFoundError(`Report ${req.params.id} not found`);
  res.json(row);
}

/** GET /reports/:id/download — download a generated file. */
export async function download(req, res) {
  const file = await service.getFile(req.params.id);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
}
