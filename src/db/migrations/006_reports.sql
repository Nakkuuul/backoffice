-- 006_reports.sql — reports-service registry/queue + a sample data table.

-- Unified registry + job queue. On-demand generation inserts one row and
-- processes it inline; bulk runs insert many 'pending' rows that the worker
-- drains with SKIP LOCKED (same pattern as the email outbox).
CREATE TABLE IF NOT EXISTS reports (
  id              BIGSERIAL PRIMARY KEY,
  report_type     TEXT NOT NULL,            -- registry key, e.g. 'client-ledger'
  format          TEXT NOT NULL,            -- pdf | csv | xlsx | html
  client_ref      TEXT,                     -- which client this report is for (bulk)
  params          JSONB,                    -- report parameters (date range, etc.)
  title           TEXT,

  status          TEXT NOT NULL DEFAULT 'pending', -- pending|generating|ready|failed
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error           TEXT,

  -- Output (local disk now; storage_ref is the abstraction for object storage later).
  storage_ref     TEXT,
  filename        TEXT,
  content_type    TEXT,
  content_sha256  TEXT,
  size_bytes      INT,

  -- Worker claim bookkeeping.
  locked_by       TEXT,
  locked_at       TIMESTAMPTZ,

  source_module   TEXT,                     -- who requested (e.g. a scheduler)
  requested_by    BIGINT REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_claim
  ON reports (status, next_attempt_at, id) WHERE status IN ('pending');
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports (report_type);
CREATE INDEX IF NOT EXISTS idx_reports_client ON reports (client_ref);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at);

-- ── Sample domain data (placeholder until real broker data tables exist) ──────
-- Lets the framework + sample 'client-ledger' report run end-to-end today.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id          BIGSERIAL PRIMARY KEY,
  client_ref  TEXT NOT NULL,
  entry_date  DATE NOT NULL,
  description TEXT NOT NULL,
  debit       NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit      NUMERIC(18,2) NOT NULL DEFAULT 0,
  balance     NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_client_date ON ledger_entries (client_ref, entry_date);

-- A little sample data so the sample report isn't empty.
INSERT INTO ledger_entries (client_ref, entry_date, description, debit, credit, balance) VALUES
  ('CL0001', '2026-06-01', 'Opening balance',            0.00,     0.00, 100000.00),
  ('CL0001', '2026-06-02', 'Buy 100 INFY @ 1500',   150000.00,     0.00, -50000.00),
  ('CL0001', '2026-06-03', 'Funds added',                0.00, 200000.00, 150000.00),
  ('CL0001', '2026-06-04', 'Brokerage + charges',       236.00,     0.00, 149764.00),
  ('CL0001', '2026-06-05', 'Sell 100 INFY @ 1560',       0.00, 156000.00, 305764.00)
ON CONFLICT DO NOTHING;
