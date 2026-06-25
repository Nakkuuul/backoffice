import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';
import { S3Storage } from './S3Storage.js';
import { LocalStorage } from './LocalStorage.js';

/**
 * Central file storage for the whole backoffice (reports, signed PDFs, email
 * attachments, …). One interface, swappable backend:
 *   STORAGE_DRIVER=s3     → MinIO/S3-compatible object storage (recommended, on-prem)
 *   STORAGE_DRIVER=local  → plain disk (fallback / dev)
 *
 * Modules address files by an object key (the `ref`), organized by a module
 * prefix, e.g. `reports/2026-06-25/foo.pdf`, `esign/...`, `email/...`.
 */
let instance;

export function getStorage() {
  if (!instance) {
    instance = config.storage.driver === 'local' ? new LocalStorage() : new S3Storage();
    logger.info({ driver: config.storage.driver }, 'storage: backend selected');
  }
  return instance;
}

/** Called once at startup to create the bucket/dir. */
export async function initStorage() {
  await getStorage().ensureReady();
}
