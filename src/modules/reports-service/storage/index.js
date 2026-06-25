import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../../config/index.js';

/**
 * Report file storage. Local disk now; the {storage_ref} string is the
 * abstraction — swap this module for a MinIO/S3 implementation later and the
 * rest of the service is unchanged. storage_ref is a path relative to the
 * configured output dir, organized by date.
 */
const baseDir = () => path.resolve(config.reports.outputDir);

/** @returns {Promise<{storageRef:string, size:number}>} */
export async function save(buffer, { filename, dateKey }) {
  const day = dateKey || new Date().toISOString().slice(0, 10);
  const dir = path.join(baseDir(), day);
  await mkdir(dir, { recursive: true });
  const ref = path.join(day, filename); // relative ref stored in DB
  await writeFile(path.join(baseDir(), ref), buffer);
  return { storageRef: ref.replace(/\\/g, '/'), size: buffer.length };
}

/** @returns {Promise<Buffer>} */
export async function read(storageRef) {
  return readFile(path.join(baseDir(), storageRef));
}

export function absolutePath(storageRef) {
  return path.join(baseDir(), storageRef);
}
