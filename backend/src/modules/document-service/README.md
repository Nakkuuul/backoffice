# document-service

Reusable PDF/file operations for the whole backoffice. Built so esign-service,
email-service, and reports-service can all use it without depending on each
other. Files live in the shared object store (MinIO/S3); this module holds the
operations + a documents registry.

```
reports-service ─┐
esign-service  ─┼─▶ document-service (compress / lock / unlock / …) ──▶ shared/storage (MinIO)
email-service  ─┘                       └── also serves esign's DocumentSource port
```

## Status

| Operation | Status | Engine |
| --------- | ------ | ------ |
| **Compress** PDF | ✅ working (verified ~47% on a sample) | qpdf (stream/object-stream recompression) |
| **Lock** (encrypt w/ password) | ✅ working (AES, default 256-bit) | qpdf |
| **Unlock** (decrypt w/ password) | ✅ working (wrong password rejected) | qpdf |
| merge / split / watermark / … | planned | pdf-lib / qpdf |

## Engine: qpdf

Compression and encryption use **qpdf** (the standard tool — AES-256, robust).
- **Linux on-prem (production):** `apt install qpdf`, leave `QPDF_BIN=qpdf`.
- **Windows (dev):** a portable qpdf in `tools/`, `QPDF_BIN` points at the exe.
- If qpdf is missing, ops return a clear `501 QPDF_NOT_AVAILABLE`; the rest of
  the app is unaffected.

`pdf/qpdf.js` wraps the binary (temp-file I/O, exit-code handling — code 3 =
warnings is treated as success). `GET /documents/health` reports the version.

## Layout

```
document-service/
├── document.routes.js      # HTTP (auth)
├── document.controller.js
├── document.service.js     # resolve input → run op → store result → register
├── document.repository.js  # documents registry table
├── document.validation.js
├── document.constants.js
├── document.init.js        # registers as esign-service DocumentSource
└── pdf/
    └── qpdf.js             # qpdf wrapper: version, compress, lock, unlock
```

## API (`/api/v1/documents`, all require auth)

| Method | Path                 | Purpose                                    |
| ------ | -------------------- | ------------------------------------------ |
| GET    | `/health`            | qpdf availability/version                  |
| POST   | `/compress`          | Compress a PDF                             |
| POST   | `/lock`              | Encrypt a PDF with a password (AES)        |
| POST   | `/unlock`            | Decrypt a PDF using its password           |
| GET    | `/`                  | List documents                             |
| GET    | `/:id`               | Document record                            |
| GET    | `/:id/download`      | Download a document file                   |

Each op takes the input as inline base64 **or** an existing document id, and by
default returns the stored document record (`download: true` streams the file):

```jsonc
// POST /documents/compress
{ "documentBase64": "JVBERi0...", "download": false }

// POST /documents/lock
{ "documentId": 12, "userPassword": "secret", "ownerPassword": "adminpw" }

// POST /documents/unlock
{ "documentId": 13, "password": "secret" }
```

Results are stored under `documents/<day>/` in object storage and recorded in
the `documents` table with provenance (`parent_id`, `operation`, `encrypted`).

## esign integration

`document.init.js` registers this module as esign-service's `DocumentSource`,
so esign `documentRef`-based signing now pulls real stored documents (the ref is
a document id).

## Diagnostics

```bash
npm run documents:test    # compress + lock + unlock round-trip via qpdf
```

## TODO / roadmap

- [ ] merge / split / page-extract (pdf-lib)
- [ ] watermark / stamp
- [ ] image downsampling for image-heavy PDFs (Ghostscript)
- [ ] upload endpoint (multipart) + retention policy
- [ ] async/bulk operations (queue) for large batches
```
