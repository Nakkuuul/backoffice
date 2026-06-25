-- 009_accounting_masters.sql — accounting masters: Groups + Ledgers (Tally-like).
-- Groups form a hierarchical chart of accounts; Ledgers are the postable
-- accounts under a group. Vouchers/transactions come later.

CREATE TABLE IF NOT EXISTS acc_groups (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  parent_id   BIGINT REFERENCES acc_groups (id),
  -- Accounting nature: drives Balance Sheet vs P&L placement.
  nature      TEXT NOT NULL CHECK (nature IN ('asset', 'liability', 'income', 'expense')),
  is_primary  BOOLEAN NOT NULL DEFAULT false,  -- top-level group (no parent)
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- predefined Tally group (protected)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_groups_parent ON acc_groups (parent_id);

CREATE TABLE IF NOT EXISTS acc_ledgers (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  group_id            BIGINT NOT NULL REFERENCES acc_groups (id),
  alias               TEXT,
  opening_balance     NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_balance_type TEXT NOT NULL DEFAULT 'Dr' CHECK (opening_balance_type IN ('Dr', 'Cr')),
  -- Optional link to a broker client (client ledgers under Sundry Debtors).
  client_ref          TEXT,
  is_system           BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_ledgers_group ON acc_ledgers (group_id);
CREATE INDEX IF NOT EXISTS idx_acc_ledgers_client ON acc_ledgers (client_ref);

-- ── Seed the 28 predefined Tally primary + sub groups (idempotent) ────────────
INSERT INTO acc_groups (name, parent_id, nature, is_primary, is_system) VALUES
  ('Capital Account',        NULL, 'liability', true, true),
  ('Loans (Liability)',      NULL, 'liability', true, true),
  ('Current Liabilities',    NULL, 'liability', true, true),
  ('Fixed Assets',           NULL, 'asset',     true, true),
  ('Investments',            NULL, 'asset',     true, true),
  ('Current Assets',         NULL, 'asset',     true, true),
  ('Branch / Divisions',     NULL, 'liability', true, true),
  ('Misc. Expenses (Asset)', NULL, 'asset',     true, true),
  ('Suspense A/c',           NULL, 'liability', true, true),
  ('Sales Accounts',         NULL, 'income',    true, true),
  ('Purchase Accounts',      NULL, 'expense',   true, true),
  ('Direct Incomes',         NULL, 'income',    true, true),
  ('Indirect Incomes',       NULL, 'income',    true, true),
  ('Direct Expenses',        NULL, 'expense',   true, true),
  ('Indirect Expenses',      NULL, 'expense',   true, true)
ON CONFLICT (name) DO NOTHING;

-- Sub-groups (parent resolved by name).
INSERT INTO acc_groups (name, parent_id, nature, is_primary, is_system)
SELECT v.name, p.id, v.nature, false, true
FROM (VALUES
  ('Reserves & Surplus',       'Capital Account',     'liability'),
  ('Bank OD A/c',              'Loans (Liability)',   'liability'),
  ('Secured Loans',            'Loans (Liability)',   'liability'),
  ('Unsecured Loans',          'Loans (Liability)',   'liability'),
  ('Duties & Taxes',           'Current Liabilities', 'liability'),
  ('Provisions',               'Current Liabilities', 'liability'),
  ('Sundry Creditors',         'Current Liabilities', 'liability'),
  ('Bank Accounts',            'Current Assets',      'asset'),
  ('Cash-in-Hand',             'Current Assets',      'asset'),
  ('Deposits (Asset)',         'Current Assets',      'asset'),
  ('Loans & Advances (Asset)', 'Current Assets',      'asset'),
  ('Stock-in-Hand',            'Current Assets',      'asset'),
  ('Sundry Debtors',           'Current Assets',      'asset')
) AS v(name, parent, nature)
JOIN acc_groups p ON p.name = v.parent
ON CONFLICT (name) DO NOTHING;
