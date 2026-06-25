import crypto from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { getStorage } from '../../shared/storage/index.js';
import * as qpdf from './pdf/qpdf.js';
import * as repo from './document.repository.js';
import { DOC_OPERATION } from './document.constants.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Resolve the input PDF bytes for an operation, from either an inline base64
 * blob or an existing stored document id. Returns { buffer, parentId, name }.
 */
async function resolveInput(input) {
  if (input.documentBase64) {
    const buffer = Buffer.from(input.documentBase64, 'base64');
    if (buffer.length === 0) throw new BadRequestError('documentBase64 decoded to empty');
    return { buffer, parentId: null, name: input.name || 'document.pdf' };
  }
  if (input.documentId) {
    const row = await repo.findById(input.documentId);
    if (!row) throw new NotFoundError(`Document ${input.documentId} not found`);
    const buffer = await getStorage().get(row.storage_ref);
    return { buffer, parentId: row.id, name: input.name || row.name };
  }
  throw new BadRequestError('Provide documentBase64 or documentId');
}

/** Store an output buffer and register a documents row. */
async function storeResult(buffer, { name, operation, parentId, encrypted, meta, requestedBy }) {
  const day = new Date().toISOString().slice(0, 10);
  const safeName = name.endsWith('.pdf') ? name : `${name}.pdf`;
  const key = `documents/${day}/${operation}_${Date.now()}_${safeName}`;
  const { ref, size } = await getStorage().put(key, buffer, 'application/pdf');
  const row = await repo.insert({
    name: safeName,
    operation,
    parentId,
    storageRef: ref,
    contentType: 'application/pdf',
    size,
    sha256: sha256(buffer),
    encrypted: Boolean(encrypted),
    meta,
    requestedBy,
  });
  return { id: row.id, name: safeName, storageRef: ref, size, buffer };
}

/** Compress a PDF. */
export async function compress(input, { requestedBy } = {}) {
  const { buffer, parentId, name } = await resolveInput(input);
  const out = await qpdf.compress(buffer);
  const ratio = buffer.length ? +(1 - out.length / buffer.length).toFixed(4) : 0;
  return storeResult(out, {
    name: `compressed_${name}`,
    operation: DOC_OPERATION.COMPRESS,
    parentId,
    meta: { originalSize: buffer.length, compressedSize: out.length, ratio },
    requestedBy,
  }).then((r) => ({ ...r, originalSize: buffer.length, ratio }));
}

/** Lock (encrypt) a PDF with a password. */
export async function lock(input, { requestedBy } = {}) {
  if (!input.userPassword && !input.ownerPassword) {
    throw new BadRequestError('userPassword or ownerPassword is required to lock');
  }
  const { buffer, parentId, name } = await resolveInput(input);
  const out = await qpdf.lock(buffer, {
    userPassword: input.userPassword,
    ownerPassword: input.ownerPassword,
  });
  return storeResult(out, {
    name: `locked_${name}`,
    operation: DOC_OPERATION.LOCK,
    parentId,
    encrypted: true,
    meta: { bits: undefined },
    requestedBy,
  });
}

/** Unlock (decrypt) a PDF using its password. */
export async function unlock(input, { requestedBy } = {}) {
  const { buffer, parentId, name } = await resolveInput(input);
  const out = await qpdf.unlock(buffer, input.password);
  return storeResult(out, {
    name: `unlocked_${name}`,
    operation: DOC_OPERATION.UNLOCK,
    parentId,
    encrypted: false,
    requestedBy,
  });
}

/* ── reads / download / health ─────────────────────────────────────────────── */

export function getDocument(id) {
  return repo.findById(id);
}
export function listDocuments(params) {
  return repo.list(params);
}
export async function getFile(id) {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError(`Document ${id} not found`);
  const buffer = await getStorage().get(row.storage_ref);
  return { buffer, filename: row.name, contentType: row.content_type };
}
export async function health() {
  try {
    return { qpdf: await qpdf.version() };
  } catch (err) {
    return { qpdf: null, error: err.message };
  }
}
