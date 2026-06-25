# Sapphire Broking — Backoffice (monorepo)

On-premise broker backoffice. Monorepo:

```
backend/    # Node monolith API + its infra (Postgres, MinIO, Haraka MTA) — see backend/README.md
frontend/   # single RBAC-driven UI (to be built)
CLAUDE.md   # full repo orientation — start here for context
```

## Quick start

```bash
cd backend
docker compose up -d        # postgres + minio + mta
npm install
cp .env.example .env        # configure (a working dev .env already exists)
npm run migrate
npm run dev                 # http://localhost:3000/api/v1/health/ready
```

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
