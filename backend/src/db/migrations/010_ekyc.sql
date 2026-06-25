-- 010_ekyc.sql — eKYC base: applications, verification checks, documents.
-- Real provider integrations (NSDL PAN, UIDAI/DigiLocker Aadhaar, penny-drop
-- bank) plug into the provider abstraction later; schema is provider-agnostic.

CREATE TABLE IF NOT EXISTS kyc_applications (
  id            BIGSERIAL PRIMARY KEY,
  -- ekyc  = new client onboarding
  -- rekyc = re-verification / modification of an existing client (client_ref required)
  kind          TEXT NOT NULL DEFAULT 'ekyc',
  -- Where the application came from + the originating system's id (idempotency).
  source        TEXT NOT NULL DEFAULT 'backoffice', -- backoffice | frontoffice
  external_ref  TEXT,
  client_ref    TEXT,                         -- existing client (required for rekyc)
  full_name     TEXT NOT NULL,
  -- For rekyc: the requested field changes (applied to the client on approval).
  changes       JSONB,
  email         TEXT,
  mobile        TEXT,
  pan           TEXT,
  aadhaar_last4 TEXT,                          -- NEVER store the full Aadhaar number
  -- Workflow: draft → submitted → in_review → approved | rejected | on_hold
  status        TEXT NOT NULL DEFAULT 'draft',
  remarks       TEXT,
  assigned_to   BIGINT REFERENCES users (id),
  submitted_at  TIMESTAMPTZ,
  decided_at    TIMESTAMPTZ,
  decided_by    BIGINT REFERENCES users (id),
  created_by    BIGINT REFERENCES users (id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_applications (status);
CREATE INDEX IF NOT EXISTS idx_kyc_client ON kyc_applications (client_ref);
CREATE INDEX IF NOT EXISTS idx_kyc_pan ON kyc_applications (pan);
CREATE INDEX IF NOT EXISTS idx_kyc_kind ON kyc_applications (kind);
-- Idempotency for frontoffice pushes: one application per external reference.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_external_ref
  ON kyc_applications (external_ref) WHERE external_ref IS NOT NULL;

-- One row per verification step on an application.
CREATE TABLE IF NOT EXISTS kyc_checks (
  id             BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES kyc_applications (id) ON DELETE CASCADE,
  -- pan | aadhaar | bank | email | mobile | signature | photo | ipv | liveness
  type           TEXT NOT NULL,
  -- pending | verified | failed | skipped
  status         TEXT NOT NULL DEFAULT 'pending',
  provider       TEXT,
  reference      TEXT,                         -- provider's verification id
  detail         JSONB,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, type)
);
CREATE INDEX IF NOT EXISTS idx_kyc_checks_app ON kyc_checks (application_id);

-- KYC documents (PAN card, photo, signature, bank proof…) stored in object storage.
CREATE TABLE IF NOT EXISTS kyc_documents (
  id             BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES kyc_applications (id) ON DELETE CASCADE,
  type           TEXT NOT NULL,                -- pan_card | aadhaar | photo | signature | bank_proof | cancelled_cheque | other
  storage_ref    TEXT NOT NULL,
  content_type   TEXT,
  size_bytes     INT,
  uploaded_by    BIGINT REFERENCES users (id),
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_app ON kyc_documents (application_id);
