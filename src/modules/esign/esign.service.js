import crypto from 'node:crypto';
import { logger } from '../../shared/utils/logger.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { getSigner } from './signer/index.js';
import { EsignDisabledError } from './signer/Pkcs11PdfSigner.js';
import * as settings from './esign.settings.js';
import { getDocumentSource, getEmailSender } from './ports/index.js';
import * as repo from './esign.repository.js';
import { ESIGN_STATUS, ESIGN_EVENT, SOURCE_MODULE } from './esign.constants.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Health probe for the DSC token (used by GET /esign/status). */
export function getSignerStatus() {
  return getSigner().getStatus();
}

/** Signing certificate currently on the token (GET /esign/certificate). */
export function getSignerCertificate() {
  return getSigner().getCertificate();
}

/**
 * Resolve the source document to a Buffer, either from an inline base64 blob
 * (dev / ad-hoc) or from the documents module via its registered port.
 * @returns {Promise<{buffer: Buffer, name: string, sourceModule: string, documentRef: string|null}>}
 */
async function resolveDocument(input) {
  if (input.documentBase64) {
    const buffer = Buffer.from(input.documentBase64, 'base64');
    if (buffer.length === 0) throw new BadRequestError('documentBase64 decoded to empty content');
    return {
      buffer,
      name: input.documentName,
      sourceModule: SOURCE_MODULE.INLINE,
      documentRef: null,
    };
  }
  // Pull from the documents module (throws 501 until that module registers).
  const doc = await getDocumentSource().getDocument(input.documentRef);
  return {
    buffer: doc.buffer,
    name: input.documentName || doc.name,
    sourceModule: SOURCE_MODULE.DOCUMENTS,
    documentRef: input.documentRef,
  };
}

/**
 * Full eSign pipeline: resolve → sign → (optionally) deliver.
 * Each stage is persisted + audited so a failure is traceable and the request
 * row reflects exactly how far it got.
 *
 * @returns {Promise<{request: object, signedBase64: string}>}
 */
export async function signDocument(input, { requestedBy } = {}) {
  // Fail fast before any DB writes when signing can't possibly proceed, so we
  // don't litter the audit table with pending→failed rows when the DSC is
  // simply turned off. Token-present/runtime errors below still get recorded.
  if (!getSigner().isEnabled()) throw new EsignDisabledError();

  const doc = await resolveDocument(input);

  // 1) Create the request row (pending) + audit, in one transaction.
  const request = await repo.withTransaction(async (client) => {
    const row = await repo.createRequest(client, {
      sourceModule: doc.sourceModule,
      documentRef: doc.documentRef,
      documentName: doc.name,
      documentSha256: sha256(doc.buffer),
      status: ESIGN_STATUS.PENDING,
      requestedBy,
    });
    await repo.addAuditEvent(client, row.id, ESIGN_EVENT.CREATED, {
      sourceModule: doc.sourceModule,
      bytes: doc.buffer.length,
    });
    return row;
  });

  try {
    // 2) Sign with the DSC.
    await repo.withTransaction(async (client) => {
      await repo.updateRequest(client, request.id, { status: ESIGN_STATUS.SIGNING });
      await repo.addAuditEvent(client, request.id, ESIGN_EVENT.SIGNING_STARTED);
    });

    const { signed, certSerial, certSubject, algorithm } = await getSigner().signPdf(
      doc.buffer,
      { reason: input.reason, location: input.location, contactInfo: input.contactInfo },
    );

    const signedHash = sha256(signed);
    await repo.withTransaction(async (client) => {
      await repo.updateRequest(client, request.id, {
        status: ESIGN_STATUS.SIGNED,
        signature_algo: algorithm,
        cert_serial: certSerial,
        cert_subject: certSubject,
        signed_sha256: signedHash,
        signed_at: new Date(),
      });
      await repo.addAuditEvent(client, request.id, ESIGN_EVENT.SIGNED, { signedHash });
    });

    // 3) Optional delivery via the email/SMTP module.
    if (input.deliver) {
      await deliver(request.id, doc.name, signed, input.deliver);
    }

    const finalRow = await repo.findById(request.id);
    return { request: finalRow, signedBase64: signed.toString('base64') };
  } catch (err) {
    logger.error({ err, requestId: request.id }, 'esign: signing failed');
    await repo.withTransaction(async (client) => {
      await repo.updateRequest(client, request.id, {
        status: ESIGN_STATUS.FAILED,
        error: err.message,
      });
      await repo.addAuditEvent(client, request.id, ESIGN_EVENT.FAILED, { message: err.message });
    });
    throw err;
  }
}

/** Hand the signed PDF to the email module and record delivery. */
async function deliver(requestId, documentName, signedBuffer, deliver) {
  await repo.withTransaction(async (client) => {
    await repo.addAuditEvent(client, requestId, ESIGN_EVENT.SEND_QUEUED, { to: deliver.to });
  });

  await getEmailSender().sendMail({
    to: deliver.to,
    subject: deliver.subject,
    body: deliver.body,
    attachments: [
      {
        filename: documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`,
        content: signedBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  await repo.withTransaction(async (client) => {
    await repo.updateRequest(client, requestId, {
      status: ESIGN_STATUS.SENT,
      delivered_to: deliver.to,
      sent_at: new Date(),
    });
    await repo.addAuditEvent(client, requestId, ESIGN_EVENT.SENT, { to: deliver.to });
  });
}

/* ── DSC PIN management ──────────────────────────────────────────────────── */

export async function setDscPin(pin, { userId } = {}) {
  await settings.setPin(pin, { userId });
}

export async function getPinStatus() {
  return {
    stored: await settings.isPinStored(),
    envFallback: Boolean(process.env.PKCS11_PIN),
  };
}

export async function clearDscPin() {
  await settings.clearPin();
}

export function getRequest(id) {
  return repo.findById(id);
}

export function listRequests(params) {
  return repo.list(params);
}
