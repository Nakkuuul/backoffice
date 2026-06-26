-- 012_twofactor.sql — TOTP two-factor authentication (authenticator app).

-- Encrypted TOTP secret (AES-256-GCM, packed iv:tag:cipher base64) + enablement.
-- A secret may be present but not yet enabled (pending enrollment until the user
-- confirms a code).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ;

-- One-time recovery codes (used if the authenticator device is lost). Only the
-- SHA-256 of each code is stored; the plaintext is shown to the user once.
CREATE TABLE IF NOT EXISTS auth_recovery_codes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_hash)
);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON auth_recovery_codes (user_id) WHERE used_at IS NULL;
