/**
 * Storage smoke test against the configured backend (MinIO/S3 or local).
 *   node scripts/test-storage.mjs
 */
import { config } from '../src/config/index.js';
import { getStorage, initStorage } from '../src/shared/storage/index.js';

console.log('driver:', config.storage.driver);
await initStorage();

const storage = getStorage();
const key = `selftest/hello-${Date.now()}.txt`;
const payload = Buffer.from('hello from backoffice storage');

const put = await storage.put(key, payload, 'text/plain');
console.log('put :', put);

const got = await storage.get(put.ref);
const match = got.equals(payload);
console.log('get :', got.toString(), match ? '✅ match' : '❌ mismatch');

const url = await storage.presignedUrl(put.ref, 600);
console.log('url :', url?.slice(0, 80) + (url && url.length > 80 ? '…' : ''));

await storage.remove(put.ref);
console.log('remove: ok');

console.log(match ? '\n✅ STORAGE OK' : '\n❌ STORAGE FAILED');
process.exit(match ? 0 : 1);
