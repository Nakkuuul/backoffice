# ekyc-service (eKYC + reKYC)

KYC for the broker — both **new client onboarding (eKYC)** and
**re-verification / detail modification of existing clients (reKYC)** — through
one workflow. The **frontoffice / onboarding portal pushes applicants in** via a
secret-authenticated intake endpoint; staff review and decide in the backoffice.

> This is a **base** to build on. Verification providers are stubbed (mock) and
> the workflow is intentionally simple; expect to refactor as the UI takes shape.

## Model

- **Application** (`kyc_applications`) — `kind` = `ekyc` (new) | `rekyc`
  (modify existing `client_ref`); `source` = `backoffice` | `frontoffice`;
  `external_ref` for frontoffice idempotency; `changes` (JSON) holds the
  requested modifications for reKYC.
- **Checks** (`kyc_checks`) — one row per verification: `pan`, `aadhaar`,
  `bank`, `mobile`, `email`, `signature`, `photo`, `ipv`, `liveness`.
- **Documents** (`kyc_documents`) — PAN card, photo, signature, bank proof…
  stored in object storage (MinIO) under `kyc/<id>/`.

### Workflow
```
draft ──submit──▶ submitted ──run check──▶ in_review ──decision──▶ approved | rejected
                       └──────────────────────────────────────────▶ on_hold ──▶ in_review
```
Transitions are guarded; **approval requires the mandatory checks** (currently
PAN) to be `verified`.

## Verification providers (pluggable)

`provider/KycProvider` is the abstraction; `StubKycProvider` returns **mock**
results (flagged `mock: true`) so the flow is testable now. Real providers
(NSDL PAN, UIDAI/DigiLocker Aadhaar, bank penny-drop) drop in behind the same
interface via `KYC_PROVIDER` — no workflow changes. (Same pattern as the esign
SignerProvider.)

> Compliance note: the **full Aadhaar number is never stored** — only
> `aadhaar_last4` + a provider reference.

## Frontoffice intake (the push channel)

`POST /api/v1/ekyc/intake` — **not** a backoffice login; authenticated by a
shared secret header `X-Frontoffice-Token` (`EKYC_INTAKE_SECRET`), same pattern
as the email inbound webhook. Idempotent on `externalRef`. Lands as `submitted`.

```jsonc
POST /api/v1/ekyc/intake     // header: X-Frontoffice-Token: <secret>
{ "externalRef": "FO-1042", "fullName": "Asha Verma", "pan": "ABCPV1234K",
  "mobile": "9876543210", "email": "asha@example.com" }
// rekyc:
{ "kind": "rekyc", "externalRef": "FO-1043", "clientRef": "CL0001",
  "fullName": "Asha Verma", "changes": { "mobile": "9000000000" } }
```

## API (`/api/v1/ekyc`)

| Method | Path | Auth / RBAC | Purpose |
| ------ | ---- | ----------- | ------- |
| POST | `/intake` | frontoffice secret | Push an applicant / rekyc (idempotent) |
| POST | `/` | `kyc:manage` | Create an application (backoffice) |
| GET | `/` | `kyc:read` | List applications |
| GET | `/:id` | `kyc:read` | Application + checks + documents |
| PATCH | `/:id` | `kyc:manage` | Edit applicant fields |
| POST | `/:id/submit` | `kyc:manage` | draft → submitted |
| POST | `/:id/checks` | `kyc:verify` | Run a verification check |
| POST | `/:id/documents` | `kyc:manage` | Attach a document (base64 → MinIO) |
| POST | `/:id/decision` | `kyc:verify` | approve / reject / hold |

## RBAC
New permissions `kyc:read` / `kyc:manage` / `kyc:verify` (+ `self:kyc:read` for
clients). Granted to: `admin` (`kyc:*`), `operations` (read+manage+verify),
`compliance` (read+verify), `auditor` (read).

## Diagnostics
```bash
npm run ekyc:test    # intake → PAN check → document → approve; idempotency; rekyc
```

## TODO / roadmap
- [ ] Real providers: NSDL PAN, UIDAI/DigiLocker Aadhaar (OTP/offline), bank penny-drop, CKYC.
- [ ] On reKYC approval, apply `changes` to the client record (needs client module).
- [ ] On eKYC approval, auto-create the client + ledger (Sundry Debtors) + login.
- [ ] Document checklist per kind; expiry/periodic-rekyc scheduling.
- [ ] Audit trail of who ran which check / made the decision.
- [ ] Client self-service status (`self:kyc:read`) for the client portal.
