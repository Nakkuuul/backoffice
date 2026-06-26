-- 015_password_reset.sql — secure "forgot access" / password-reset credentials.
-- Only SHA-256 hashes of the link token / OTP are stored (never plaintext), so a
-- DB leak cannot be replayed. Short-lived, single-use, attempt-limited.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,               -- sha256 of the raw link token / OTP
  kind         TEXT NOT NULL,               -- 'link' | 'otp'
  channel      TEXT NOT NULL,               -- 'email' | 'sms'
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,                 -- single-use: set when consumed/locked
  attempts     INTEGER NOT NULL DEFAULT 0,  -- wrong-OTP attempts (brute-force guard)
  requested_ip TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_active ON password_reset_tokens (user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens (expires_at);
