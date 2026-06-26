-- 011_auth.sql — auth-service: forced-password-change flag + revocable sessions.

-- Users created by an admin (master seed / register / admin reset) must change
-- their password on first login. Self-service change clears this.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Refresh-token sessions (the raw token is never stored — only its SHA-256).
-- Enables refresh rotation and logout/revocation.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_hash  TEXT NOT NULL UNIQUE,
  user_agent    TEXT,
  ip            TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions (expires_at) WHERE revoked_at IS NULL;
