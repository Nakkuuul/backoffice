# Shared object storage

Central file storage for the entire backoffice — generated reports, signed
PDFs, email attachments, and any other binary artifact. One interface, a
swappable backend chosen by `STORAGE_DRIVER`:

- **`s3`** (default, recommended): MinIO on-prem — an S3-compatible object store.
  High-performance, scales to billions of objects, distributed mode + erasure
  coding when you grow. Same API as AWS S3, so it's portable.
- **`local`**: plain disk under `STORAGE_LOCAL_DIR` (dev / fallback).

```
modules ──▶ getStorage()  ──▶  S3Storage (MinIO)  | LocalStorage (disk)
                                key/ref            |
```

## Why object storage (not Postgres bytea or a raw folder)
- Keeps large binaries **out of Postgres** → lean DB, fast backups/replication,
  no memory pressure on the email/report queues at scale.
- Handles **billions of objects** without the directory/inode problems a plain
  filesystem hits.
- Gives **presigned URLs**, lifecycle/retention policies, and a clean scaling
  path (single-node → distributed MinIO → real S3) with no code change.

## Interface

```js
import { getStorage } from 'src/shared/storage/index.js';
const s = getStorage();
await s.put(key, buffer, contentType);  // → { ref, size }   (ref === key)
await s.get(ref);                       // → Buffer
await s.presignedUrl(ref, expiresIn);   // → time-limited download URL (s3)
await s.remove(ref);
```

Files are namespaced by a module prefix so everything lives together logically:
`reports/<day>/<file>`, `esign/<...>`, `email/<...>`.

`initStorage()` (called at app boot) creates the bucket if missing.

## Infrastructure (docker-compose)
- **minio** — the object store. API on `:9000`, web console on `:9001`
  (login with `S3_ACCESS_KEY` / `S3_SECRET_KEY`). Data in the `minio-data` volume.
- **minio-setup** — one-shot job that creates the `S3_BUCKET` on first run.

```bash
docker compose up -d minio minio-setup
npm run storage:test       # put/get/presign/remove round-trip
```

## At scale (on-prem, high volume)
- **Retention/lifecycle**: set rules to expire old files per regulatory
  retention (SEBI record-keeping) so disk doesn't grow unbounded.
- **Redundancy**: single-node MinIO = one disk's risk. For production-critical
  volume, run **distributed MinIO** (4+ drives/nodes, erasure coding) + a
  backup/DR copy. Start single-node, scale when justified.
- **Capacity**: plan disk for the real data flow; object storage is cheap to
  grow but must be provisioned.
