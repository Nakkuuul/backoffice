# Backoffice

Monolithic Node.js backoffice for broker operations. Designed for **on-premise deployment** on the broker's local server.

- **Runtime:** Node.js 20+ (ESM)
- **HTTP:** Express
- **Database:** PostgreSQL (`pg`)
- **Logging:** pino (JSON in prod)
- **Process manager:** PM2 (cluster mode)

## Architecture

A **modular monolith**: one deployable process, organized into self-contained feature modules. Each module follows a layered pattern:

```
routes → controller → service → repository → database
```

- **routes** — HTTP endpoints and middleware wiring
- **controller** — parse request / shape response (no business logic)
- **service** — business rules, orchestration, transactions
- **repository** — all SQL / data access (uses the shared pool)

## Folder structure

```
backoffice/
├── src/
│   ├── server.js              # entry point: HTTP server + graceful shutdown
│   ├── app.js                 # Express app assembly (no side effects)
│   ├── config/                # env loading + validated config
│   ├── api/
│   │   ├── routes/            # top-level route aggregator
│   │   └── middlewares/       # auth, validate, error handler, 404
│   ├── modules/               # feature modules (modular monolith)
│   │   ├── health/            # liveness/readiness probes
│   │   ├── esign-service/     # PDF signing via physical DSC (PKCS#11) — LIVE
│   │   ├── email-service/     # durable SMTP outbox + worker fleet (DKIM, suppression)
│   │   ├── reports-service/   # client reports in PDF/CSV/XLSX/HTML (HTML→PDF)
│   │   └── document-service/  # PDF ops (compress, lock/unlock) via qpdf
│   ├── db/
│   │   ├── pool.js            # shared PostgreSQL pool + withTransaction
│   │   └── migrations/        # NNN_name.sql forward migrations
│   └── shared/
│       ├── errors/            # AppError hierarchy
│       ├── utils/             # logger, asyncHandler, crypto, ...
│       └── storage/           # object storage (MinIO/S3 | local) for all files
├── mta/                       # broker's own SMTP server (Haraka) — outbound MTA
├── scripts/                   # migrate.js + per-module test/CLI scripts
├── tests/                     # integration tests
├── logs/                      # runtime logs (gitignored)
├── ecosystem.config.cjs       # PM2 deployment config
└── .env.example
```

> Note: authentication is enforced by `src/api/middlewares/authenticate.js`
> (JWT) used across modules, and the `users` table backs ownership FKs — a
> dedicated auth/users module hasn't been built yet.

## Getting started

```bash
cp .env.example .env      # already created for local; fill in real secrets for prod
npm install
docker compose up -d      # start PostgreSQL 16 (local dev DB)
npm run migrate           # apply DB migrations
npm run dev               # start with auto-reload
```

`docker-compose.yml` runs the on-prem infrastructure:
- **postgres** (16-alpine) — primary database (`backoffice-pgdata` volume)
- **minio** + **minio-setup** — S3-compatible object storage for all generated
  files; API `:9000`, console `:9001` (`backoffice-minio-data` volume)
- **mta** (Haraka) — the broker's own SMTP server (see `mta/README.md`)

Credentials come from `.env`. Stop with `docker compose down` (add `-v` to wipe data).

Health check: `GET http://localhost:3000/api/v1/health/live`

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start with `--watch` auto-reload     |
| `npm start`        | Start (production)                   |
| `npm run migrate`  | Apply pending DB migrations          |
| `npm test`         | Run tests (node:test)                |
| `npm run storage:test` | Object-storage round-trip check  |
| `npm run lint`     | Lint                                 |
| `npm run format`   | Format with Prettier                 |

## Deployment (local server)

```bash
npm ci --omit=dev
npm run migrate
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
```

## Modules

| Module   | Status   | Notes                                                              |
| -------- | -------- | ------------------------------------------------------------------ |
| health   | live     | Liveness/readiness probes                                          |
| esign-service | **live** | Signs PDFs (PAdES) with a physical DSC over PKCS#11. See its README |
| email-service | **working** | Durable Postgres outbox + horizontal worker fleet, DKIM, suppression, templating. Auto-receives signed docs from esign-service. See its README |
| reports-service | **framework** | Generates client reports in PDF/CSV/XLSX/HTML (HTML→PDF via Chromium); on-demand + bulk queue; pluggable report definitions. See its README |
| document-service | **working** | Reusable PDF operations — compress, lock/unlock (qpdf, AES-256). Serves esign's DocumentSource. See its README |
| mta (Haraka)  | scaffolded | Broker's own outbound SMTP server (direct-to-MX) the app submits to. On-prem deploy; see `mta/README.md` for the deliverability reality check |

### Native dependency note (eSign)

The eSign module uses native PKCS#11 bindings (`graphene-pk11` → `pkcs11js`).
These compile/prebuild on install and are required on the broker server, along
with the DSC token's vendor middleware (the PKCS#11 `.dll`/`.so`). If deploying
to a host without the token toolchain, eSign endpoints degrade gracefully
(`ESIGN_DISABLED` / `PKCS11_DEPENDENCY_MISSING`) rather than crashing the app.

## Adding a module

1. Create `src/modules/<name>/` with `<name>.routes.js`, `.controller.js`, `.service.js`, `.repository.js`, `.validation.js`.
2. Mount it in `src/api/routes/index.js`.
3. Add migrations under `src/db/migrations/`.
