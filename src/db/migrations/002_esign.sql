-- 002_esign.sql — eSign module schema
-- Tracks every signing request and its lifecycle for audit/compliance.

CREATE TABLE IF NOT EXISTS esign_requests (
  id              BIGSERIAL PRIMARY KEY,

  -- Where the source document comes from. Once the document module exists,
  -- document_ref points at it; source_module records the origin.
  source_module   TEXT NOT NULL DEFAULT 'inline',
  document_ref    TEXT,
  document_name   TEXT NOT NULL,
  document_sha256 TEXT,                 -- hash of the ORIGINAL (pre-sign) bytes

  -- Lifecycle: pending -> signing -> signed -> sent | failed
  status          TEXT NOT NULL DEFAULT 'pending',
  error           TEXT,

  -- Signature metadata captured from the DSC at signing time.
  signature_algo  TEXT,
  cert_serial     TEXT,
  cert_subject    TEXT,
  signed_sha256   TEXT,                 -- hash of the SIGNED output
  signed_at       TIMESTAMPTZ,

  -- Delivery (handed to the email/SMTP module).
  delivered_to    TEXT[],
  sent_at         TIMESTAMPTZ,

  requested_by    BIGINT REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esign_requests_status ON esign_requests (status);
CREATE INDEX IF NOT EXISTS idx_esign_requests_created_at ON esign_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_esign_requests_document_ref ON esign_requests (document_ref);

-- Append-only event log for compliance audit.
CREATE TABLE IF NOT EXISTS esign_audit_events (
  id          BIGSERIAL PRIMARY KEY,
  request_id  BIGINT NOT NULL REFERENCES esign_requests (id) ON DELETE CASCADE,
  event       TEXT NOT NULL,            -- e.g. created, signing_started, signed, send_queued, failed
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esign_audit_request_id ON esign_audit_events (request_id);
