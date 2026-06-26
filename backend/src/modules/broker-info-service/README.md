# broker-info-service

The broker's own **entity profile** — the data behind **Masters → Company Info**.
A **singleton** record (`company_profile`, id pinned to 1) plus structured
per-exchange **memberships** (`company_memberships`). Seeded on first boot; the
frontend fetches it to render Company Info.

> Renamed from `company-service`. The public **API path stays `/api/v1/company`**
> and the DB tables stay `company_*` for frontend/data compatibility — only the
> module (folder + files + boot wiring) was renamed.

## Data

**Profile** (singleton) — identity & statutory (trade/legal name, entity type,
date of incorporation, founded year, CIN, PAN, GSTIN, TAN, SEBI reg, logo);
addresses (registered + head office, JSONB) & contacts (phone, email, website,
support/grievance email); compliance & KMP (compliance/principal officer, key
personnel list); **depository participation** (self-DP vs third-party DP, with the
provider's details) & **bank accounts**; conventions (base currency, financial-year
start, timezone).

**Memberships** (one row per exchange) — exchange (NSE/BSE/MCX/NCDEX/MSEI),
membership type, Trading Member ID, **clearing mode** (self-clearing vs third-party
clearing member + that clearer's details), SEBI segment registration, and the
enabled **segments** (CASH/FNO/CURRENCY/COMMODITY/DEBT/SLB) as a text[].

## API (`/api/v1/company`)

| Method | Path | Perm | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/company/public` | public | brand-safe fields for the login screen (no auth) |
| GET | `/company` | `company:read` | `{ profile, memberships, activeSegments, dpMode }` |
| PUT | `/company` | `company:manage` | partial update of the profile |
| POST | `/company/memberships` | `company:manage` | add an exchange membership |
| PATCH | `/company/memberships/:id` | `company:manage` | update a membership |
| DELETE | `/company/memberships/:id` | `company:manage` | remove a membership |

`activeSegments` is a derived union of all active memberships' segments; `dpMode`
is the derived depository nature (none / self / third_party / mixed).

## RBAC
`company:read` granted to all broker staff (admin, accountant, compliance,
operations, support, auditor); `company:manage` to admin (and super_admin via `*`).

## Boot
`initBrokerInfoService()` seeds the singleton (defaults) + example NSE/BSE/MCX
memberships and depository participation on first boot, then is a no-op.

## Test
```bash
npm run broker-info:test   # service-level: profile + memberships CRUD
```
