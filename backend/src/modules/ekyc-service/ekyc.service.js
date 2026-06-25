import { BadRequestError, NotFoundError, ConflictError } from '../../shared/errors/AppError.js';
import { getStorage } from '../../shared/storage/index.js';
import { getKycProvider } from './provider/index.js';
import * as repo from './ekyc.repository.js';
import {
  KYC_STATUS,
  KYC_TRANSITIONS,
  KYC_KIND,
  KYC_SOURCE,
  CHECK_STATUS,
  CHECK_TYPES,
  REQUIRED_CHECKS,
} from './ekyc.constants.js';

function assertKind(kind, clientRef) {
  if (kind === KYC_KIND.REKYC && !clientRef) {
    throw new BadRequestError('rekyc requires a clientRef (the existing client to modify)');
  }
}

function assertTransition(from, to) {
  if (!(KYC_TRANSITIONS[from] || []).includes(to)) {
    throw new ConflictError(`Cannot move a KYC application from "${from}" to "${to}"`);
  }
}

/** Create an application from inside the backoffice (staff-initiated). */
export async function createApplication(input, { createdBy } = {}) {
  const kind = input.kind || KYC_KIND.EKYC;
  assertKind(kind, input.clientRef);
  return repo.createApplication({
    kind,
    source: KYC_SOURCE.BACKOFFICE,
    clientRef: input.clientRef,
    fullName: input.fullName,
    email: input.email,
    mobile: input.mobile,
    pan: input.pan?.toUpperCase(),
    aadhaarLast4: input.aadhaarLast4,
    changes: input.changes,
    status: KYC_STATUS.DRAFT,
    createdBy,
  });
}

/**
 * Frontoffice intake — the onboarding portal pushes a new applicant (or a
 * rekyc modification) into the backoffice. Idempotent on `externalRef`; lands
 * as `submitted` so staff pick it up for review.
 */
export async function intake(input) {
  if (input.externalRef) {
    const existing = await repo.findByExternalRef(input.externalRef);
    if (existing) return { id: existing.id, status: existing.status, deduped: true };
  }
  const kind = input.kind || KYC_KIND.EKYC;
  assertKind(kind, input.clientRef);
  const row = await repo.createApplication({
    kind,
    source: KYC_SOURCE.FRONTOFFICE,
    externalRef: input.externalRef,
    clientRef: input.clientRef,
    fullName: input.fullName,
    email: input.email,
    mobile: input.mobile,
    pan: input.pan?.toUpperCase(),
    aadhaarLast4: input.aadhaarLast4,
    changes: input.changes,
    status: KYC_STATUS.SUBMITTED,
  });
  await repo.markSubmitted(row.id);
  return { id: row.id, status: KYC_STATUS.SUBMITTED, deduped: false };
}

export async function getApplication(id) {
  const app = await repo.findById(id);
  if (!app) throw new NotFoundError(`KYC application ${id} not found`);
  const [checks, documents] = await Promise.all([repo.listChecks(id), repo.listDocuments(id)]);
  return { ...app, checks, documents };
}

export function listApplications(params) {
  return repo.list(params);
}

export async function updateApplication(id, fields) {
  const app = await repo.findById(id);
  if (!app) throw new NotFoundError(`KYC application ${id} not found`);
  if ([KYC_STATUS.APPROVED, KYC_STATUS.REJECTED].includes(app.status)) {
    throw new ConflictError(`A ${app.status} application cannot be edited`);
  }
  if (fields.pan) fields.pan = fields.pan.toUpperCase();
  return repo.updateApplication(id, fields);
}

/** Move draft → submitted (staff-initiated submit). */
export async function submit(id) {
  const app = await repo.findById(id);
  if (!app) throw new NotFoundError(`KYC application ${id} not found`);
  assertTransition(app.status, KYC_STATUS.SUBMITTED);
  if (!app.full_name) throw new BadRequestError('full name is required to submit');
  if (app.kind === KYC_KIND.EKYC && !app.pan) throw new BadRequestError('PAN is required to submit');
  await repo.markSubmitted(id);
  return getApplication(id);
}

/** Run a verification check via the provider and record the result. */
export async function runCheck(id, type, payload = {}) {
  if (!CHECK_TYPES.includes(type)) throw new BadRequestError(`Unknown check type: ${type}`);
  const app = await repo.findById(id);
  if (!app) throw new NotFoundError(`KYC application ${id} not found`);

  // Default PAN payload from the application if not supplied.
  const data = { name: app.full_name, pan: app.pan, ...payload };
  const result = await getKycProvider().verify(type, data);
  const check = await repo.upsertCheck(id, type, {
    status: result.verified ? CHECK_STATUS.VERIFIED : CHECK_STATUS.FAILED,
    provider: result.provider,
    reference: result.reference,
    detail: result.detail,
  });

  // First check on a submitted app moves it into review.
  if (app.status === KYC_STATUS.SUBMITTED) await repo.updateApplication(id, { status: KYC_STATUS.IN_REVIEW });
  return check;
}

/** Attach a KYC document (stored in object storage under kyc/<id>/). */
export async function attachDocument(id, { type, buffer, contentType }, { uploadedBy } = {}) {
  const app = await repo.findById(id);
  if (!app) throw new NotFoundError(`KYC application ${id} not found`);
  const key = `kyc/${id}/${type}_${Date.now()}`;
  const { ref, size } = await getStorage().put(key, buffer, contentType || 'application/octet-stream');
  return repo.addDocument({ applicationId: id, type, storageRef: ref, contentType, size, uploadedBy });
}

/**
 * Decide an application: approve | reject | on_hold (with workflow guard).
 * Approval requires the mandatory checks to be verified.
 */
export async function decide(id, { decision, remarks }, { decidedBy } = {}) {
  const target = {
    approve: KYC_STATUS.APPROVED,
    reject: KYC_STATUS.REJECTED,
    hold: KYC_STATUS.ON_HOLD,
  }[decision];
  if (!target) throw new BadRequestError('decision must be approve | reject | hold');

  const app = await repo.findById(id);
  if (!app) throw new NotFoundError(`KYC application ${id} not found`);
  assertTransition(app.status, target);

  if (target === KYC_STATUS.APPROVED) {
    const checks = await repo.listChecks(id);
    const verified = new Set(checks.filter((c) => c.status === CHECK_STATUS.VERIFIED).map((c) => c.type));
    const missing = REQUIRED_CHECKS.filter((c) => !verified.has(c));
    if (missing.length) {
      throw new ConflictError(`Cannot approve — required checks not verified: ${missing.join(', ')}`);
    }
    // TODO (post client-module): on rekyc approval, apply `app.changes` to the client.
  }
  return repo.setDecision(id, { status: target, remarks, decidedBy });
}
