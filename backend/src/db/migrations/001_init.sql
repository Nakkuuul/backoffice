-- 001_init.sql — initial schema baseline
-- Each migration file is wrapped in a transaction by the runner.

CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'user',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
