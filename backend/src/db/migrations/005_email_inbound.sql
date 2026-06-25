-- 005_email_inbound.sql — inbound mail received via the MTA (bounces,
-- complaints, replies). Bounces/complaints auto-populate email_suppressions.

CREATE TABLE IF NOT EXISTS email_inbound (
  id              BIGSERIAL PRIMARY KEY,
  message_id      TEXT,
  from_address    TEXT,
  to_addresses    TEXT[],
  subject         TEXT,
  -- Classification: bounce | complaint | reply | other
  type            TEXT NOT NULL DEFAULT 'other',
  -- The address a bounce/complaint refers to (added to suppression list).
  related_address TEXT,
  -- DSN status (e.g. 5.1.1) for bounces.
  dsn_status      TEXT,
  raw             TEXT,            -- full raw message (offload at scale)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_inbound_type ON email_inbound (type);
CREATE INDEX IF NOT EXISTS idx_email_inbound_related ON email_inbound (related_address);
CREATE INDEX IF NOT EXISTS idx_email_inbound_created ON email_inbound (created_at);
