-- 008_user_rbac.sql — extend users for RBAC (broker staff + client logins).
-- Roles & permissions are defined in code (src/modules/user-service/rbac.js);
-- this stores each user's identity, scope, and assigned role.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_type   TEXT NOT NULL DEFAULT 'broker', -- broker | client
  ADD COLUMN IF NOT EXISTS client_ref  TEXT,                           -- links a client user to their client account
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  BIGINT REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_users_type ON users (user_type);
CREATE INDEX IF NOT EXISTS idx_users_client_ref ON users (client_ref);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
