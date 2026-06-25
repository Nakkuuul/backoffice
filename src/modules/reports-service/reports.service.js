import crypto from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { getReport, listReports } from './registry.js';
import { render } from './renderers/index.js';
import * as storage from './storage/index.js';
import * as repo from './reports.repository.js';
import { FORMATS } from './reports.constants.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function buildFilename(def, format, params) {
  const fmt = FORMATS[format];
  const who = params?.clientRef ? `_${params.clientRef}` : '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${def.key}${who}_${stamp}.${fmt.ext}`;
}

/**
 * Core: produce the actual file for a report request. Used by both the
 * on-demand path (inline) and the bulk worker.
 * @returns {Promise<{buffer, contentType, ext, filename, storageRef, sha256, size, title}>}
 */
export async function produce({ reportType, format, params }) {
  const def = getReport(reportType);
  if (!def) throw new BadRequestError(`Unknown report type: ${reportType}`);
  if (!def.formats.includes(format)) {
    throw new BadRequestError(`Report '${reportType}' does not support format '${format}'`);
  }

  const data = await def.resolveData(params || {});
  data.generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const { buffer, contentType, ext } = await render(def, data, format);
  const filename = buildFilename(def, format, params);
  const { storageRef, size } = await storage.save(buffer, { filename });

  return {
    buffer,
    contentType,
    ext,
    filename,
    storageRef,
    sha256: sha256(buffer),
    size,
    title: data.title,
  };
}

/**
 * On-demand generation: create a registry row, produce the file inline, mark
 * ready, and return the file (for immediate download/streaming).
 */
export async function generateNow({ reportType, format, params, requestedBy }) {
  const row = await repo.insert({ reportType, format, params, clientRef: params?.clientRef, requestedBy });
  try {
    const out = await produce({ reportType, format, params });
    await repo.markReady(row.id, out);
    return { id: row.id, ...out };
  } catch (err) {
    await repo.markFailed(row.id, err.message, { attempts: 1, maxAttempts: 1 });
    throw err;
  }
}

/**
 * Bulk: enqueue many report jobs (e.g. one per client) for the worker to drain.
 * @param {object} input { reportType, format, items:[{clientRef, params}], requestedBy }
 */
export async function enqueueBulk({ reportType, format, items, requestedBy, sourceModule }) {
  const def = getReport(reportType);
  if (!def) throw new BadRequestError(`Unknown report type: ${reportType}`);
  if (!def.formats.includes(format)) {
    throw new BadRequestError(`Report '${reportType}' does not support format '${format}'`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('items[] is required for a bulk run');
  }
  const jobs = items.map((it) => ({
    reportType,
    format,
    clientRef: it.clientRef,
    params: it.params ?? { clientRef: it.clientRef },
    requestedBy,
    sourceModule,
  }));
  const count = await repo.insertMany(jobs);
  return { enqueued: count };
}

/** Process one claimed job row (used by the worker). */
export async function runJob(row) {
  const out = await produce({
    reportType: row.report_type,
    format: row.format,
    params: row.params || {},
  });
  await repo.markReady(row.id, out);
  return out;
}

/* ── reads / download ───────────────────────────────────────────────────────── */

export function getJob(id) {
  return repo.findById(id);
}
export function listJobs(params) {
  return repo.list(params);
}
export function availableReports() {
  return listReports();
}

/** Fetch a generated file for download. */
export async function getFile(id) {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError(`Report ${id} not found`);
  if (row.status !== 'ready' || !row.storage_ref) {
    throw new BadRequestError(`Report ${id} is not ready (status: ${row.status})`);
  }
  const buffer = await storage.read(row.storage_ref);
  return { buffer, filename: row.filename, contentType: row.content_type };
}
