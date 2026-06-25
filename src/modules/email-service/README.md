# email-service

High-throughput, durable email sending for the backoffice. Its primary job is
to take **esigned documents from `esign-service`** and deliver them to clients,
but it accepts any transactional email.

```
esign-service ──(registerEmailSender)──▶ email-service.enqueue ──▶ [ outbox ]
                                                                       │
                                            worker fleet (SKIP LOCKED) ▼
                                              nodemailer (pooled, DKIM) ──▶ SMTP relay ──▶ client
```

## Status: ✅ working (verified against a local SMTP sink)

Enqueue, idempotency, suppression, templating, attachments, the worker
claim/send loop, retries/backoff, and dead-lettering are implemented and tested
end-to-end (`npm run email:test`). Transport is unconfigured by default
(`SMTP_HOST` empty) — the worker stays idle until you point it at a relay.

## Design — how it scales to 100M emails in 6 hours

100M / 6h ≈ **4,630 emails/second sustained**. No single Node process or
self-hosted MTA on a local IP achieves that. The architecture separates the
three concerns so each scales independently:

1. **Durable outbox (Postgres).** `enqueue()` writes the message and returns
   immediately (`202 Accepted`). A 100M burst is accepted at write speed and
   drained later — send rate is decoupled from accept rate.
2. **Horizontal worker fleet.** Each worker claims a batch with
   `SELECT … FOR UPDATE SKIP LOCKED`, so any number of worker **processes**
   drain the same outbox with zero double-sends. Scale throughput by running
   more `npm run email:worker` processes across machines/containers.
3. **Transport + MTA.** Each worker holds a pooled nodemailer SMTP connection to
   the broker's **own Haraka MTA** (`../../../mta`), which delivers direct-to-MX.
   The MTA + its sending IPs are the real ceiling — nodemailer is never the
   bottleneck.

> **On-prem reality:** this app is deployed on the broker's on-prem server (no
> cloud / no SES). At that scale the binding constraint is **outbound port 25
> availability, the number of static IPs, and IP warmup/reputation** — not code.
> 100M/6h to the inbox from a handful of on-prem IPs is not physically
> achievable; see `mta/README.md` for the honest ceiling and what is realistic.

### Fleet sizing (rule of thumb)

| Quantity | Value |
| --- | --- |
| Target | 4,630 msg/s |
| Per-worker throughput to a fast relay | ~100–300 msg/s |
| **Workers needed** | **~20–50** (add headroom: 40–60) |
| MTA + IP capacity | must deliver ≥4,630 msg/s — i.e. **hundreds of warmed static IPs** with port-25 egress (see `mta/README.md`). This is the real on-prem ceiling. |

### Scale checklist (beyond app code)
- **Attachments → shared storage.** 100M × ~100KB ≈ 10 TB. Store esigned PDFs on
  on-prem shared storage (NAS / local object store like MinIO / the documents
  module) and put a path/pointer in `email_attachments.storage_ref`; the worker
  streams from there. Inline `bytea` is dev-only. (Worker already prefers
  `storage_ref` via nodemailer `path`.)
- **Partition the outbox by day** and prune `sent`/`failed` rows so the claim
  index stays small at 100M rows/day.
- **Run API and workers separately:** set `EMAIL_WORKER_ENABLED=false` on API
  hosts; run the worker fleet as its own deployment.
- **Tune** `EMAIL_WORKER_CONCURRENCY`, `EMAIL_BATCH_SIZE`, and `SMTP_RATE_LIMIT`
  per worker against the relay's limits.

## Deliverability — staying out of spam

The app controls these; do all of them:
- **DKIM signing** (`npm run email:gen-dkim` → publish the DNS TXT). Biggest lever.
- **SPF** aligned to the relay; **DMARC** with `p=quarantine`+ and strict alignment.
- **Multipart text + HTML**, simple table-free markup, transactional tone.
- **`List-Unsubscribe` + one-click** (`EMAIL_UNSUBSCRIBE_URL`) for bulk.
- **Suppression list** — never resend to hard bounces / complaints.
- **Per-worker rate limiting** to avoid ISP throttling/blocks.

Infra/reputation (outside app code) — equally essential at volume: dedicated,
**warmed** sending IPs; valid PTR/rDNS; bounce + complaint feedback loops wired
back into the suppression list; gradual volume ramp.

## Layout

```
email-service/
├── email.routes.js        # HTTP routes (auth)
├── email.controller.js    # request/response, base64 attachment decode
├── email.service.js       # enqueue (idempotency, suppression, templating, headers) + esign port impl
├── email.repository.js    # outbox SQL incl. SKIP LOCKED claim, suppression, events
├── email.worker.js        # concurrent claim-and-send loops, retries/backoff, DLQ
├── email.init.js          # registers EmailSender into esign-service; starts/stops worker
├── email.validation.js    # Joi schemas
├── email.constants.js     # statuses, events, suppression reasons
├── transport/
│   ├── index.js            # getTransport() singleton
│   ├── SmtpTransport.js    # pooled nodemailer wrapper (+ DKIM, TLS, rate limit)
│   └── dkim.js             # load DKIM signing key
└── templates/
    └── index.js            # dependency-free renderer: 'generic', 'signed-document'
```

## API (`/api/v1/email`, all require auth)

| Method | Path                       | Purpose                                   |
| ------ | -------------------------- | ----------------------------------------- |
| POST   | `/send`                    | Enqueue an email → `202` `{id,status}`    |
| GET    | `/messages`                | List outbox messages                      |
| GET    | `/messages/:id`            | One message                               |
| GET    | `/health`                  | Relay reachability + outbox status counts |
| POST   | `/suppressions`            | Add address to suppression list (admin)   |
| DELETE | `/suppressions/:address`   | Remove from suppression list (admin)      |

`POST /send` body:

```jsonc
{
  "to": ["client@example.com"],
  "subject": "Your signed contract note",        // or omit and use a template
  "template": "signed-document",
  "templateData": { "clientName": "Asha", "documentTitle": "Contract Note" },
  "attachments": [{ "filename": "note.pdf", "contentBase64": "JVBERi0..." }],
  "idempotencyKey": "esign-42",                   // optional, makes enqueue safe to retry
  "priority": 5
}
```

## esign-service integration

`email.init.js` registers `sendMailFromEsign` as the esign-service
`EmailSender`. So when an esign request includes `deliver`, the signed PDF is
enqueued here automatically — no coupling between the modules beyond the port.

## Running the worker fleet

```bash
# API host (no worker):
EMAIL_WORKER_ENABLED=false npm start
# Worker hosts (run many):
npm run email:worker        # scale: more processes / more machines
```

## Diagnostics

```bash
npm run email:gen-dkim s1 yourdomain.com    # generate DKIM key + print DNS records
SMTP_HOST=127.0.0.1 SMTP_PORT=2526 SMTP_SECURE=false \
  node scripts/test-email.mjs               # full pipeline vs a local SMTP sink
```

## TODO / roadmap

- [ ] **Object-storage attachments** — stream from `storage_ref` (documents
      module) instead of inline `bytea`; required for 100M scale.
- [ ] **Outbox partitioning by day** + automated pruning of terminal rows.
- [ ] **Bounce/complaint webhooks** — endpoint to ingest relay feedback and
      auto-populate the suppression list (provider-specific).
- [ ] **Scheduled sends** — `send_at` column for the "daily batch" use case.
- [ ] **Per-domain throttling** — honor different rate limits per recipient ISP.
- [ ] **Templating** — richer template set + optional MJML/Handlebars if needed.
- [ ] **Metrics** — export Prometheus counters (queued/sent/deferred/failed, send latency).
- [ ] **Redis/BullMQ option** — alternative queue backbone if Postgres claim
      contention becomes the limit.
```
