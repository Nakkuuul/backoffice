# CLAUDE.md — Broker Backoffice (read this first)

This file orients a new session on the whole repository: what it is, how it's
laid out, how to run it, every module, the conventions, and the honest caveats.
Keep it updated as the system evolves.

---

## 1. What this is

An **on-premise broker backoffice** for a stock broker (India; domain
`sapphirebroking.net` for the email/MTA work, the company is "Sapphire
Broking"). It is deployed on the **broker's own local server — NOT the cloud**.
That on-prem constraint is fundamental and recurs throughout (no SES/S3 cloud
assumptions; use local equivalents like MinIO and a self-hosted MTA).

- **Architecture:** modular **monolith** (one Node process, feature modules).
- **Repo shape:** **monorepo** — `backend/` (this app) now; `frontend/` to come.
  The plan is to build the UI next and **refactor the services from the UI
  inward**, so expect churn driven by the frontend.
- **Single UI:** one frontend; what each user sees is driven by their **RBAC
  permissions** (returned from `GET /auth/me`), and enforced on the backend.

Today's date context in earlier sessions was 2026-06-25.

---

## 2. Repository layout

```
/ (repo root — monorepo)
├── CLAUDE.md            # this file
├── README.md           # short monorepo overview
├── .gitignore          # root; patterns match backend/** too
├── .claude/  .idea/    # tooling/IDE
├── backend/            # the Node backoffice app + its infra (everything below)
└── frontend/           # the single UI — Next.js 16 + TS + Tailwind (App Router, src/)
                        #   dev on :3001 (backend is :3000). NOTE: Next 16 differs
                        #   from training data — read frontend/AGENTS.md + Next's
                        #   node_modules/next/dist/docs/ before writing UI code.
```

```
backend/
├── package.json            # scripts + deps (type: module, ESM)
├── docker-compose.yml      # postgres + minio (+ setup) + mta;  name: backoffice
├── .env / .env.example     # all configuration (dotenv)
├── eslint.config.js .prettierrc.json .nvmrc ecosystem.config.cjs (PM2)
├── mta/                    # Haraka MTA (broker's own SMTP server) — Docker image
├── secrets/                # DKIM private key (gitignored)
├── tools/                  # portable qpdf for Windows dev (gitignored)
├── scripts/                # migrate.js + per-module test/CLI scripts (*.mjs)
├── tests/                  # node:test integration tests
└── src/
    ├── server.js           # entry: boot infra inits → HTTP listen → graceful shutdown
    ├── app.js              # express assembly (helmet, cors, compression, pino-http)
    ├── config/index.js     # ALL env read + validated here (single source)
    ├── api/
    │   ├── routes/index.js # mounts every module under /api/v1
    │   └── middlewares/     # authenticate (JWT), authorize, requirePermission, validate, errorHandler, notFound
    ├── db/
    │   ├── pool.js         # shared pg Pool: query, getClient, withTransaction
    │   └── migrations/     # NNN_*.sql, applied in order by scripts/migrate.js
    ├── shared/
    │   ├── errors/AppError.js   # AppError + BadRequest/Unauthorized/Forbidden/NotFound/Conflict
    │   ├── utils/          # logger (pino), asyncHandler, crypto (AES-256-GCM)
    │   └── storage/        # object storage abstraction (S3/MinIO | local) — getStorage()
    └── modules/            # feature modules (see §7)
```

**Module file convention** (every module follows this layered pattern):
`*.routes.js → *.controller.js → *.service.js → *.repository.js`, plus
`*.validation.js` (Joi), `*.constants.js`, and a `*.init.js` when it needs
boot-time wiring (port registration / workers). Routes guard with
`requirePermission(...)`; controllers are thin; services hold logic; repositories
hold all SQL.

---

## 3. Tech stack

- Node 20+ (ESM, `"type":"module"`), Express 4, PostgreSQL (`pg`), Joi, pino.
- Auth: `jsonwebtoken` + `bcryptjs`.
- Storage: MinIO (S3-compatible) via `@aws-sdk/client-s3`.
- eSign: `graphene-pk11` (PKCS#11) + `pkijs`/`asn1js` (CMS) + `@signpdf/*` + `pdf-lib`.
- Email: `nodemailer` + a self-hosted **Haraka** MTA; `mailparser` for inbound.
- Reports: HTML→PDF via `puppeteer` (Chromium), `exceljs` (xlsx).
- Documents: **qpdf** binary (compress, AES encrypt/decrypt).
- Dev/test SMTP sink: `smtp-server`.

---

## 4. How to run

All commands run **from `backend/`**.

```bash
cd backend
cp .env.example .env          # fill secrets; a working .env already exists in dev
docker compose up -d          # postgres + minio (+bucket) + mta (Haraka)
npm install
npm run migrate               # apply DB migrations (idempotent)
npm run dev                   # start app (node --watch) on :3000
# health: GET http://localhost:3000/api/v1/health/ready
```

There is **no `seed`** script (removed). A super_admin was bootstrapped in dev:
`admin@sapphirebroking.net` / `Sapphire@12345` — **change in real use**. Create
users with `npm run user:create -- <email> <pass> <role> [clientRef] [fullName]`.

**Windows/dev gotchas the prior session hit repeatedly:**
- The app runs on the **host** (not in Docker); only Postgres/MinIO/MTA are
  containerized. The app reaches them on `localhost`.
- To free port 3000 before re-launching: kill the listening PID
  (`netstat -ano | grep :3000` → `taskkill //PID <pid> //F`). Tests/boot loops
  do this.
- `docker compose` project name is pinned to `backoffice` (in compose `name:`),
  so containers/volumes are stable regardless of cwd.

---

## 5. Infrastructure (docker-compose, project `backoffice`)

| Service | Container | Ports (host) | Notes |
| ------- | --------- | ------------ | ----- |
| PostgreSQL 16 | `backoffice-postgres` | `5432` | volume `backoffice-pgdata`; db/user/pass = `backoffice`/`backoffice`/`backoffice_local` (dev) |
| MinIO | `backoffice-minio` | `9000` API, `9001` console | volume `backoffice-minio-data`; creds `backoffice`/`backoffice_secret`; bucket `backoffice` (created by `minio-setup`) |
| Haraka MTA | `backoffice-mta` | `25` (inbound MX), `127.0.0.1:2525` (submission) | volume `backoffice-mta-queue`; env-driven (see §7 email/mta) |

MinIO console: http://localhost:9001 (`backoffice` / `backoffice_secret`).

---

## 6. Cross-cutting conventions

- **Config:** only `src/config/index.js` reads `process.env`. Everything imports
  from `config`. `toBool`/`required` helpers there.
- **Errors:** throw `AppError` subclasses; `errorHandler` middleware maps them to
  HTTP (operational vs masked 500). `asyncHandler` wraps async routes.
- **DB:** `withTransaction(fn)` for atomic units. Workers claim rows with
  `SELECT … FOR UPDATE SKIP LOCKED` (email + reports) so multiple instances
  scale without double-processing.
- **Object storage:** never store file bytes in Postgres. Use
  `getStorage().put/get/remove/presignedUrl`; the DB stores a `storage_ref`
  (object key). Keys are namespaced: `reports/`, `documents/`, `kyc/`.
- **Dependency-inversion seams (ports):** modules that need *other* modules
  register implementations at boot rather than importing each other:
  - `esign-service` exposes `registerEmailSender` and `registerDocumentSource`
    (in `esign-service/ports`). `email-service` and `document-service` register
    into them in their `*.init.js` (called from `server.js`). Confirmed at boot
    via log lines "registered as esign-service EmailSender/DocumentSource".
- **Machine-to-machine webhooks** use a shared-secret header, NOT JWT:
  - email inbound: `POST /email/inbound` with `X-Inbound-Token` (EMAIL_INBOUND_SECRET).
  - eKYC intake: `POST /ekyc/intake` with `X-Frontoffice-Token` (EKYC_INTAKE_SECRET).
- **Adding a module:** create `src/modules/<name>/`, follow the layered files,
  guard routes with `requirePermission`, mount it in `src/api/routes/index.js`,
  add any boot wiring to `server.js`, add migration `NNN_*.sql`, add RBAC perms
  in `user-service/rbac.js`, write a `scripts/test-*.mjs`, and a module README.

---

## 7. Modules (status + detail)

All mounted under `/api/v1`. All require auth except the two secret webhooks.

### health — `/health` (live)
`/live`, `/ready` (ready also pings DB). No auth.

### user-service — `/auth`, `/users` (live)
Users + JWT auth (bcrypt) + **RBAC**. Two scopes: **broker** staff and
**client**. Roles & permissions are **code-defined** in `rbac.js` (not a DB
table) — see §8. `GET /auth/me` returns `{user, permissions}` (the UI reads this
to show/hide features). `/users` is admin-guarded (`users:read`/`users:manage`).
`/users/roles` returns the catalog for the frontend. JWT payload:
`{ id, role, type, clientRef }`. CLI: `npm run user:create`.

### esign-service — `/esign` (live; needs hardware)
Signs PDFs (PAdES, `adbe.pkcs7.detached`) with a **physical DSC token** over
PKCS#11. Verified working on a Longmai mToken (`CryptoIDA_pkcs11.dll`); DSC
`CN=Nakul Pratap Thakur`, issuer SpeedSign. The private key never leaves the
token (only the RSA op runs on-device). Visible signature stamp via pdf-lib.
Token **PIN** is stored AES-256-GCM in `esign_settings` (primary) with
`PKCS11_PIN` env as fallback — manage via `/esign/config/pin` (esign:config).
Gated by `ESIGN_ENABLED`. Native deps (`graphene-pk11`) lazy-loaded so the app
boots without the token. `signer/` has the PKCS#11 + CMS code.

### email-service — `/email` (working; delivery blocked by ISP, see §11)
Durable **outbox** (`email_messages`) + horizontal **worker** (SKIP LOCKED) →
nodemailer → the Haraka MTA. DKIM signing (app-side, key in `secrets/`),
suppression list, idempotency, `List-Unsubscribe`, templates. Inbound:
`POST /email/inbound` (MTA forwards received mail) → classify bounce/complaint →
auto-suppress. Registers as esign's `EmailSender`. Scale design documented for
100M/6h (fleet of `npm run email:worker`).

### mta/ — Haraka SMTP server (the broker's own MTA)
A **separate Docker service**, not a Node module. Env-driven via
`mta/entrypoint.sh`: `MTA_DELIVERY_MODE=direct|relay`. **direct** = direct-to-MX
(needs ISP outbound :25 + PTR — currently blocked, see §11). **relay** =
smtp_forward through an upstream on :587 (e.g. **Amazon SES** — the chosen path;
awaiting SES SMTP creds). Listens :25 (inbound MX) + :2525 (submission, trusted
relay only via `local_relay` custom plugin). `inbound_forward` plugin POSTs
received mail to the app webhook.

### reports-service — `/reports` (framework)
Generates client reports in **PDF/CSV/XLSX/HTML**. PDF = HTML template →
Chromium (Puppeteer, shared browser). On-demand + **bulk queue** (worker).
Pluggable **report definitions** (`definitions/`, one sample `client-ledger`).
Files stored in MinIO. **Real broker report formats/names are still pending from
the user** — add definitions when provided.

### document-service — `/documents` (working)
Reusable PDF ops via **qpdf**: **compress** and **lock/unlock** (AES-256
encrypt/decrypt). Input = base64 or an existing document id (chaining); output
stored in MinIO + `documents` registry. Registers as esign's `DocumentSource`.
`QPDF_BIN` configurable (Windows dev uses portable qpdf in `tools/`; Linux
on-prem = `apt install qpdf`).

### accounting-service — `/accounting` (masters only)
Tally-Prime-like. **Group Master** (28 predefined Tally groups seeded) +
**Ledger Master**, plus **Balance Sheet** and **P&L** (computed from ledger
**opening balances** today; the math is centralized so closing = opening +
Σ(postings) drops in once vouchers exist). **Vouchers/transactions deferred
until the UI is ready** (user's explicit decision).

### ekyc-service — `/ekyc` (base)
**eKYC + reKYC** workflow (new onboarding vs modify existing client). Frontoffice
pushes applicants via secret-authed `POST /ekyc/intake` (idempotent on
`external_ref`). Workflow draft→submitted→in_review→approved/rejected/on_hold;
approval gated on required checks (PAN). Pluggable **KycProvider** (stub/mock
now; NSDL/UIDAI/penny-drop later). Documents in MinIO. Full Aadhaar never stored
(only `aadhaar_last4`). It's a **base** to refactor against the UI.

---

## 8. RBAC (user-service/rbac.js)

Code-defined catalog. **Permissions** are `domain:action` with wildcards (`*`,
`reports:*`). Enforced by `requirePermission(...)` (and `authorize(...roles)`;
`super_admin` bypasses both).

- **Domains:** users, clients, esign, email, reports, documents, accounting,
  kyc, system, self (client self-service).
- **Broker roles:** `super_admin` (`*`), `admin` (most + `*:` wildcards, NOT
  `esign:config`/`system:config`), `accountant` (`accounting:*` + reads),
  `compliance`, `operations`, `support`, `auditor` (read-only).
- **Client role:** `client` (`self:*` only; data-scoping by `client_ref` is a
  per-endpoint TODO).
- Frontend drives UI from `GET /auth/me` `.permissions`; backend enforces
  independently. **Important:** when adding routes, always add `requirePermission`
  — an integration test once caught feature routes that only checked
  `authenticate` (any valid token), letting a client hit them.

---

## 9. Database

Migrations (`backend/src/db/migrations`, applied by `npm run migrate`):
`001_init` (users), `002_esign`, `003_esign_settings`, `004_email_service`,
`005_email_inbound`, `006_reports`, `007_documents`, `008_user_rbac`,
`009_accounting_masters`, `010_ekyc`. Simple forward-only runner tracking
`schema_migrations`. **No down migrations.**

Gotcha seen: `users.id` sequence drifted because an early test inserted an
explicit `id=1`; resync with
`SELECT setval(pg_get_serial_sequence('users','id'), (SELECT max(id) FROM users))`.

---

## 10. Configuration (.env) — grouped

App (PORT/HOST), DB (DB_*), Auth (JWT_*), CORS. Then per concern:
- **eSign:** `ESIGN_ENABLED`, `PKCS11_LIB_PATH`, `PKCS11_PIN` (fallback),
  `ESIGN_*` appearance.
- **email:** `EMAIL_FROM/DOMAIN/...`, `SMTP_*` (points at the MTA :2525),
  `DKIM_*`, `EMAIL_WORKER_*`, `EMAIL_INBOUND_SECRET`.
- **mta:** `MTA_DELIVERY_MODE`, `MTA_HOSTNAME`, `MTA_LOCAL_DOMAINS`,
  `RELAY_HOST/PORT/USER/PASS` (SES, when relaying), `APP_INBOUND_URL`.
- **storage:** `STORAGE_DRIVER=s3`, `S3_*` (MinIO).
- **documents:** `QPDF_BIN`, `PDF_ENCRYPTION_BITS`.
- **reports:** `REPORTS_WORKER_*`, `REPORTS_PUPPETEER_ARGS`.
- **ekyc:** `KYC_PROVIDER=stub`, `EKYC_INTAKE_SECRET`.

DNS for `sapphirebroking.net` already set (A `mail`, SPF, DKIM `s1._domainkey`,
DMARC `p=quarantine`). PTR is **not** set (ISP must do it).

---

## 11. Honest caveats / open threads (READ before email/esign work)

1. **Email cannot actually deliver yet.** The ISP **blocks outbound port 25**
   (verified: 587/465 open, 25 times out), so direct-to-MX is impossible on this
   line. Inbound :25 works. The agreed fix is **MTA relay mode via Amazon SES on
   :587** — *awaiting the user's SES SMTP creds* (region/host, user, pass) +
   domain verification + sandbox exit. Until then, mail reaches the MTA
   ("accepted") but sits in the outbound queue. The app→MTA path is fully working.
2. **eSign needs the physical DSC token plugged in** + the PIN configured.
   `ESIGN_ENABLED=true` in dev; the token was present and signing verified.
3. **qpdf** must exist on the host. Linux: `apt install qpdf`. Windows dev uses a
   portable copy in `backend/tools/` (gitignored) referenced by absolute
   `QPDF_BIN`.
4. **Puppeteer/Chromium** is heavy; launched lazily on first PDF render and
   reused. `--no-sandbox` is set.
5. **Reports** has only a sample definition — real formats pending from the user.
6. **Accounting** is masters + statements only; vouchers deferred to post-UI.

---

## 12. Test / diagnostic scripts (`npm run …`, from backend/)

`test` (node:test), `test:integration` (full cross-service HTTP check — 13
checks), `storage:test`, `documents:test`, `reports:test`, `email:test`
(local SMTP sink), `email:test-inbound`, `users:test`, `accounting:test`,
`ekyc:test`. Plus ops: `migrate`, `user:create`, `email:worker` (standalone
worker), `email:gen-dkim`, `lint`, `format`. `send-test-email.mjs` sends a real
email through the MTA.

**Lint is kept clean** — `mta/`, `tools/`, `storage-data/` are eslint-ignored
(vendored/native). Run `npm run lint` after changes.

---

## 13. Roadmap (what's next)

- **Frontend** (`frontend/`, monorepo) — single RBAC-driven UI, then **refactor
  services from the UI inward**. (React+Vite suggested; not yet scaffolded.)
- Finish **SES relay** to unblock email delivery.
- Real **report definitions** from the user.
- **Accounting vouchers** (double-entry) → trial balance, day book — post-UI.
- **eKYC** real providers (NSDL/UIDAI/bank) + on-approval auto-create
  client+ledger+login.
- A **client module** (the `client_ref` referenced across modules) — onboarding
  output target for eKYC.
- Optional: RBAC **role inheritance** (Snowflake-style hierarchy); per-endpoint
  **client data-scoping** for `client` users.
