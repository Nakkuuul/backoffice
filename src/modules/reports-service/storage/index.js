import { getStorage } from '../../../shared/storage/index.js';

/**
 * Reports file storage — thin wrapper over the shared backend (MinIO/S3 or
 * disk). Keys are namespaced under `reports/<day>/` so all report files live
 * together in the object store. `storageRef` (the returned key) is what's saved
 * in the DB and used for download.
 */
export async function save(buffer, { filename, dateKey, contentType }) {
  const day = dateKey || new Date().toISOString().slice(0, 10);
  const key = `reports/${day}/${filename}`;
  const { ref, size } = await getStorage().put(key, buffer, contentType);
  return { storageRef: ref, size };
}

export function read(storageRef) {
  return getStorage().get(storageRef);
}

export function presignedUrl(storageRef, expiresIn) {
  return getStorage().presignedUrl(storageRef, expiresIn);
}
