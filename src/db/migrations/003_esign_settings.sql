-- 003_esign_settings.sql — encrypted operational settings for eSign.
-- Single-row table (id is pinned to 1) holding the DSC token PIN encrypted at
-- rest with AES-256-GCM. Plaintext PIN is NEVER stored.

CREATE TABLE IF NOT EXISTS esign_settings (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pin_iv        BYTEA,        -- AES-GCM nonce
  pin_tag       BYTEA,        -- AES-GCM auth tag
  pin_cipher    BYTEA,        -- encrypted PIN
  pin_set_by    BIGINT REFERENCES users (id),
  pin_set_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure the singleton row exists.
INSERT INTO esign_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
