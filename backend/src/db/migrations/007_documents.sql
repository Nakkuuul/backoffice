-- 007_documents.sql — document-service registry. Tracks documents and the
-- files produced by operations (compress/lock/unlock). Bytes live in object
-- storage (MinIO); this table holds metadata + the storage_ref.

CREATE TABLE IF NOT EXISTS documents (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  -- How this document came to be: upload | compress | lock | unlock
  operation      TEXT NOT NULL DEFAULT 'upload',
  -- If derived from another document, its id (provenance chain).
  parent_id      BIGINT REFERENCES documents (id),

  storage_ref    TEXT NOT NULL,            -- object key in shared storage
  content_type   TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes     INT,
  content_sha256 TEXT,
  encrypted      BOOLEAN NOT NULL DEFAULT false,

  meta           JSONB,                    -- op params / results (e.g. ratio)
  source_module  TEXT,
  requested_by   BIGINT REFERENCES users (id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents (parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_operation ON documents (operation);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents (created_at);
