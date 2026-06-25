import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/index.js';

/**
 * Local-disk fallback storage. Same interface as S3Storage so modules don't
 * care which backend is active. `ref` is the object key (used as a relative path).
 */
export class LocalStorage {
  #base() {
    return path.resolve(config.storage.local.dir);
  }

  async ensureReady() {
    await mkdir(this.#base(), { recursive: true });
  }

  async put(key, buffer) {
    const full = path.join(this.#base(), key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
    return { ref: key.replace(/\\/g, '/'), size: buffer.length };
  }

  async get(ref) {
    return readFile(path.join(this.#base(), ref));
  }

  async remove(ref) {
    await unlink(path.join(this.#base(), ref)).catch(() => {});
  }

  /** No signed URLs on disk — return the absolute path for reference. */
  async presignedUrl(ref) {
    return path.join(this.#base(), ref);
  }
}
