# Sapphire Broking — Backoffice (monorepo)

On-premise broker backoffice. Monorepo:

```
backend/    # Node monolith API + its infra (Postgres, MinIO, Haraka MTA) — see backend/README.md
frontend/   # single RBAC-driven UI (to be built)
CLAUDE.md   # full repo orientation — start here for context
```

## Quick start

The whole stack is driven by [go-task](https://taskfile.dev) from the repo root:

```bash
task bootstrap   # one-time: install deps, prepare env, start infra, migrate
task up          # bring it all up — infra + backend (:3000) + frontend (:3001)
task pull        # update code + container images
task             # list all commands (also: task down, task status)
```

Or run pieces manually from `backend/` (`docker compose up -d`, `npm run migrate`,
`npm run dev`) — see `backend/README.md`.

## What's inside (backend)

Modular monolith with: **user-service** (auth + RBAC), **esign-service** (DSC
PDF signing), **email-service** (+ own Haraka MTA), **reports-service**
(PDF/CSV/XLSX/HTML), **document-service** (qpdf compress/lock), **accounting-service**
(Tally-like masters + BS/P&L), **ekyc-service** (eKYC/reKYC). Object storage via
MinIO. See **`CLAUDE.md`** for the complete picture and **`backend/README.md`**
for backend specifics. Each module has its own README under
`backend/src/modules/<name>/`.

## Deployment

On the broker's on-prem server: run the infra via `docker compose`, the API via
PM2 (`backend/ecosystem.config.cjs`), fronted by nginx (serves the built
frontend + proxies `/api`).
```
