# company-service

The broker's own **entity profile** — the data behind **Masters → Company Info**.
A **singleton** record (`company_profile`, id pinned to 1) plus structured
per-exchange **memberships** (`company_memberships`). Seeded on first boot; the
frontend fetches it to render Company Info.

## Data

**Profile** (singleton) — identity & statutory (trade/legal name, entity type,
date of incorporation, founded year, CIN, PAN, GSTIN, TAN, SEBI reg, logo);
addresses (registered + head office, JSONB) & contacts (phone, email, website,
support/grievance email); compliance & KMP (compliance/principal officer, key
personnel list); depository & banking (NSDL/CDSL DP IDs, bank accounts list);
conventions (base currency, financial-year start, timezone).

**Memberships** (one row per exchange) — exchange (NSE/BSE/MCX/NCDEX/MSEI),
membership type, Trading/Clearing Member IDs, CM code, SEBI segment registration,
and the enabled **segments** (CASH/FNO/CURRENCY/COMMODITY/DEBT/SLB) as a text[].

## API (`/api/v1/company`)

| Method | Path | Perm | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/company` | `company:read` | `{ profile, memberships, activeSegments }` |
| PUT | `/company` | `company:manage` | partial update of the profile |
| POST | `/company/memberships` | `company:manage` | add an exchange membership |
| PATCH | `/company/memberships/:id` | `company:manage` | update a membership |
| DELETE | `/company/memberships/:id` | `company:manage` | remove a membership |

`activeSegments` is a derived union of all active memberships' segments.

## RBAC
`company:read` granted to all broker staff (admin, accountant, compliance,
operations, support, auditor); `company:manage` to admin (and super_admin via `*`).

## Boot
`initCompanyService()` seeds the singleton (Sapphire Broking defaults) + example
NSE/BSE memberships on first boot, then is a no-op.

## Test
```bash
npm run company:test   # service-level: profile + memberships CRUD
```
