-- 004_email_service.sql — email-service outbox, attachments, suppression, events.
-- Designed for a high-volume worker-drained outbox (claim with SKIP LOCKED).

CREATE TABLE IF NOT EXISTS email_messages (
  id              BIGSERIAL PRIMARY KEY,

  -- Idempotency: callers may pass a key to make enqueue safe to retry.
  idempotency_key TEXT UNIQUE,

  -- Envelope / headers.
  from_address    TEXT NOT NULL,
  from_name       TEXT,
  to_addresses    TEXT[] NOT NULL,
  cc_addresses    TEXT[],
  bcc_addresses   TEXT[],
  reply_to        TEXT,
  subject         TEXT NOT NULL,
  body_html       TEXT,
  body_text       TEXT,
  headers         JSONB,                     -- extra headers (List-Unsubscribe, etc.)

  -- Routing / provenance.
  template        TEXT,                      -- template name if rendered
  source_module   TEXT,                      -- e.g. 'esign-service'
  source_ref      TEXT,                      -- e.g. esign request id
  priority        SMALLINT NOT NULL DEFAULT 5, -- lower = sooner

  -- Lifecycle. queued -> sending -> sent | failed | suppressed; deferred = waiting retry.
  status          TEXT NOT NULL DEFAULT 'queued',
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 6,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  provider_message_id TEXT,                  -- relay's accepted id

  -- Worker claim bookkeeping.
  locked_by       TEXT,
  locked_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

-- Hot path: workers pull due, sendable rows by (status, next_attempt_at, priority).
CREATE INDEX IF NOT EXISTS idx_email_claim
  ON email_messages (status, next_attempt_at, priority, id)
  WHERE status IN ('queued', 'deferred');

CREATE INDEX IF NOT EXISTS idx_email_status ON email_messages (status);
CREATE INDEX IF NOT EXISTS idx_email_source ON email_messages (source_module, source_ref);

-- Attachments stored out-of-row. NOTE: bytea is fine for moderate volume; at
-- 100M-scale move large blobs to object storage and keep only a reference here.
CREATE TABLE IF NOT EXISTS email_attachments (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES email_messages (id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
  content       BYTEA,                       -- inline content (or NULL if using storage_ref)
  storage_ref   TEXT,                        -- pointer to object store, if offloaded
  content_sha256 TEXT,
  size_bytes    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON email_attachments (message_id);

-- Suppression list: never send to these (hard bounces, complaints, unsubscribes).
CREATE TABLE IF NOT EXISTS email_suppressions (
  address     TEXT PRIMARY KEY,
  reason      TEXT NOT NULL,                 -- bounce | complaint | unsubscribe | manual
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only event log for observability / audit.
CREATE TABLE IF NOT EXISTS email_events (
  id          BIGSERIAL PRIMARY KEY,
  message_id  BIGINT REFERENCES email_messages (id) ON DELETE CASCADE,
  event       TEXT NOT NULL,                 -- queued | sending | sent | deferred | failed | suppressed | bounced | complained
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_message ON email_events (message_id);
