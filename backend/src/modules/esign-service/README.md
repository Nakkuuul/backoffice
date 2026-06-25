# eSign module

Signs PDF documents (PAdES, `adbe.pkcs7.detached`) using a **physical DSC
token** attached to the server, over the **PKCS#11** interface. Sits between the
future `documents` module (source of PDFs) and the future `email` module
(delivery to clients).

```
documents module ──▶ esign (sign with DSC) ──▶ email/SMTP module ──▶ client
       (port)                                        (port)
```

## Status: ✅ LIVE (verified against hardware)

Signing has been tested end-to-end against the physical token on this machine:

- **Token:** Longmai mToken CryptoIDA — `C:\Windows\System32\CryptoIDA_pkcs11.dll`
- **DSC:** `CN=Nakul Pratap Thakur, O=Personal, C=IN` (serial `6b954d22c436`),
  issued by `SpeedSign DSC Sub CA 2022`, valid to 2027-11-25.
- **Chain:** full 4-cert chain on the token (leaf → SpeedSign Sub CA → Speed
  Sign CA → CCA India 2022 root), all embedded in the signature.
- **Verification:** message digest matches the PDF ByteRange and the RSA
  signature over the signed attributes verifies against the leaf certificate.

The private key never leaves the token — only the SHA-256/RSA operation over the
CMS SignedAttributes is performed on-device (`CKM_SHA256_RSA_PKCS`).

## Layout

```
esign/
├── esign.routes.js        # HTTP routes (all authenticated)
├── esign.controller.js    # request/response
├── esign.service.js       # pipeline: resolve doc → sign → deliver, fully audited
├── esign.repository.js    # SQL for esign_requests + esign_audit_events
├── esign.settings.js      # encrypted DSC PIN storage + resolution (env → DB)
├── esign.validation.js    # Joi schemas
├── esign.constants.js     # statuses, audit event names
├── signer/
│   ├── SignerProvider.js   # interface every signing backend implements
│   ├── Pkcs11PdfSigner.js  # PKCS#11 + PAdES adapter (lazy native deps)
│   ├── token.js            # PKCS#11 session, key/cert chain loading, raw signing
│   ├── cms.js              # CMS/PKCS#7 SignedData builder (pkijs)
│   ├── appearance.js       # visible signature stamp + widget placeholder (pdf-lib)
│   ├── errors.js           # typed errors (disabled / not configured / token / deps)
│   └── index.js            # getSigner() factory
└── ports/
    └── index.js            # DocumentSource + EmailSender contracts + registry
```

## DSC PIN handling

So operators aren't prompted on every signing call, the PIN is resolved in this
order at signing time:

1. **Encrypted PIN in the DB** (`esign_settings`, AES-256-GCM via `ESIGN_ENC_KEY`) — primary
2. `PKCS11_PIN` env var — fallback (bring-up / CI, or if the DB row is cleared)

Manage the stored PIN via admin-only endpoints (PIN is never returned):

```
POST   /api/v1/esign/config/pin   { "pin": "…" }   # store (encrypted)
GET    /api/v1/esign/config/pin                     # { stored, envOverride }
DELETE /api/v1/esign/config/pin                     # remove
```

> Security note: the PIN is encrypted at rest with `ESIGN_ENC_KEY`. Keep that
> key out of the database and out of source control. On the broker server,
> prefer a real secret store; the env var is the minimum bar.

## Visible signature appearance

By default a visible stamp is drawn on the document: a bordered block showing
`Digitally signed by`, the signer CN (from the cert), the signing date, and the
reason/location. The signature widget is placed over it, so it appears both on
the page and in the viewer's Signature Panel.

Configured via env:

| Var                  | Default          | Meaning                                              |
| -------------------- | ---------------- | ---------------------------------------------------- |
| `ESIGN_VISIBLE`      | `true`           | Draw a visible stamp; `false` = invisible signature  |
| `ESIGN_STAMP_PAGE`   | `first`          | `first` or `last` page                               |
| `ESIGN_STAMP_CORNER` | `bottom-right`   | `bottom-right`/`bottom-left`/`top-right`/`top-left`  |
| `ESIGN_REASON`       | (see .env)       | Reason line shown in the stamp + signature dict      |
| `ESIGN_LOCATION`     | empty            | Optional location line                               |

If the visible path fails for a particular document, signing falls back to an
invisible signature (xref-stream PDFs are normalized via pdf-lib automatically).

## API (`/api/v1/esign`, all require auth)

| Method | Path             | Purpose                                  |
| ------ | ---------------- | ---------------------------------------- |
| GET    | `/status`        | DSC token availability (no signing)      |
| GET    | `/certificate`   | Signing certificate + chain length       |
| POST   | `/sign`          | Sign a PDF; optionally email it          |
| GET    | `/requests`      | List signing requests (audit history)    |
| GET    | `/requests/:id`  | One request with signature/audit details |
| POST   | `/config/pin`    | Store DSC PIN (admin)                    |
| GET    | `/config/pin`    | PIN configured? (admin)                  |
| DELETE | `/config/pin`    | Clear stored PIN (admin)                 |

`POST /sign` body — supply exactly one source:

```jsonc
{
  "documentName": "contract-note-2026-06-25.pdf",
  "documentBase64": "JVBERi0xLj...",   // OR "documentRef": "<id from documents module>"
  "reason": "Contract note",            // optional appearance overrides
  "deliver": {                           // optional: hand signed PDF to email module
    "to": ["client@example.com"],
    "subject": "Your signed contract note"
  }
}
```

Returns `201` with the persisted request row and `signedBase64` (the signed PDF).

## Diagnostics

```bash
npm run esign:test-sign   # generate a PDF, sign on the token, verify CMS
npm run esign:test-pin    # encrypt/store/recover the PIN via the DB
npm run esign:test-api    # exercise the HTTP endpoint (server must be running)
```

## Integrating the future modules

When you build them, register their implementations during bootstrap — no
changes needed inside eSign:

```js
import { registerDocumentSource, registerEmailSender } from './modules/esign-service/ports/index.js';

registerDocumentSource({ getDocument: (ref) => documentsService.fetch(ref) });
registerEmailSender({ sendMail: (msg) => emailService.send(msg) });
```

Until then, `documentRef`-based signing and `deliver` return `501
PORT_NOT_REGISTERED`; inline `documentBase64` signing is fully working.

## TODO / roadmap

- [x] **Visible signature appearance** — bordered stamp (signer, date, reason)
      drawn via pdf-lib, configurable page/corner. _Possible enhancements: logo/
      image, custom layout, drawing into the field AP stream instead of page._
- [ ] **PAdES-B-B compliance** — add the ESS `signing-certificate-v2` signed
      attribute (currently contentType + signingTime + messageDigest).
- [ ] **Trusted timestamp (RFC 3161 TSA)** — embed a timestamp token so
      signatures remain verifiable after the cert expires (PAdES-B-T).
- [ ] **LTV** — embed OCSP/CRL for long-term validation (PAdES-B-LT).
- [ ] **Persist the signed PDF** — today the signed bytes are returned inline;
      store them (documents module / object store) and keep only a reference.
- [ ] **documents module integration** — implement `DocumentSource` and pull by
      `documentRef`.
- [ ] **email module integration** — implement `EmailSender` for `deliver`.
- [ ] **Concurrency** — the token is single-session; serialize signing requests
      (queue) so parallel calls don't collide on the device.
- [ ] **PIN lockout safety** — surface remaining PIN attempts / handle
      `CKR_PIN_LOCKED` distinctly to avoid bricking the token.
```
