# reports-service

Generates the reports a broker provides to clients, in **PDF, CSV, XLSX, and
HTML**. It's the front of the document pipeline:

```
reports-service (generate) ──▶ esign-service (sign) ──▶ email-service (deliver) ──▶ client
```

## Status: ✅ framework working (verified all 4 formats)

The generation framework is complete and tested end-to-end on a sample report.
**Real broker reports plug in as definitions** — when the consolidated formats /
report names are provided, each becomes one file under `definitions/` with zero
changes to the rest of the service.

## How it works

- **Data:** from this app's Postgres (see `definitions/*` `resolveData`).
- **PDF:** HTML/CSS template → PDF via headless Chromium (Puppeteer), shared
  browser instance reused across renders.
- **CSV/XLSX:** generated from the definition's `columns` + `rows` (exceljs for xlsx).
- **Run model:** on-demand (inline) **and** bulk (durable queue + worker with
  `SKIP LOCKED`, same pattern as the email outbox).
- **Storage:** the shared object store (**MinIO/S3**, `src/shared/storage`),
  keyed under `reports/<day>/`, tracked in the `reports` table via `storage_ref`.
  Falls back to local disk with `STORAGE_DRIVER=local`.

## Layout

```
reports-service/
├── reports.routes.js      # HTTP (auth)
├── reports.controller.js
├── reports.service.js     # produce() core; generateNow (sync) + enqueueBulk + runJob
├── reports.repository.js  # reports registry/queue incl. SKIP LOCKED claim
├── reports.worker.js      # bulk generation worker
├── reports.init.js        # registers definitions; starts/stops worker; closes Chromium
├── registry.js            # report-definition registry (pluggable)
├── definitions/
│   └── client-ledger.js   # SAMPLE report (replace/extend with real ones)
├── renderers/
│   ├── index.js           # render(def, data, format)
│   ├── html.js            # generic print-ready HTML (default layout)
│   ├── pdf.js             # HTML → PDF (Puppeteer, shared browser)
│   ├── csv.js             # RFC-4180 CSV
│   └── excel.js           # styled .xlsx (exceljs)
└── storage/index.js       # local-disk save/read (storage_ref abstraction)
```

## Adding a report (the part you'll do per real report)

Create `definitions/<key>.js`:

```js
export default {
  key: 'contract-note',
  title: 'Contract Note',
  formats: ['pdf', 'csv', 'xlsx', 'html'],
  async resolveData(params) {
    // query Postgres → return { title, meta, columns:[{key,header,align,money}], rows:[...] }
  },
  // optional: renderHtml(data) for a bespoke PDF/HTML layout instead of the generic table
};
```

Then register it in `reports.init.js` (one import line). Done — all formats,
queue, storage, and delivery work automatically.

## API (`/api/v1/reports`, all require auth)

| Method | Path                  | Purpose                                        |
| ------ | --------------------- | ---------------------------------------------- |
| GET    | `/types`              | List available report definitions + formats    |
| POST   | `/generate`           | Generate one report now (returns file or job)   |
| POST   | `/bulk`               | Enqueue a bulk run (items[] → one job each)     |
| GET    | `/`                   | List report jobs                               |
| GET    | `/:id`                | Job record                                     |
| GET    | `/:id/download`       | Download a generated file                      |

`POST /generate` body:

```jsonc
{
  "reportType": "client-ledger",
  "format": "pdf",                       // pdf | csv | xlsx | html
  "params": { "clientRef": "CL0001", "from": "2026-06-01", "to": "2026-06-30" },
  "download": true                        // true = stream file; false = return job id
}
```

`POST /bulk` body (e.g. nightly statements for all clients):

```jsonc
{
  "reportType": "client-ledger",
  "format": "pdf",
  "items": [ { "clientRef": "CL0001" }, { "clientRef": "CL0002" } ]
}
```

## Diagnostics

```bash
npm run reports:test      # generate the sample report in all 4 formats, verify output
```

## TODO / roadmap

- [ ] **Real report definitions** — drop in the broker's consolidated formats.
- [ ] **esign integration** — option to auto-sign generated PDFs via esign-service.
- [ ] **email integration** — option to auto-deliver via email-service (per client).
- [ ] **Scheduling** — nightly bulk runs (cron) for daily statements.
- [x] **Object storage** — files stored in shared MinIO/S3 (`src/shared/storage`).
- [ ] **Branding** — logo/letterhead + per-report templates.
- [ ] **Streaming for large reports** — stream rows to CSV/XLSX to bound memory.
```
