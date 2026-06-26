-- 013_company.sql — Company Info master (the broker's own entity profile).
-- Singleton: exactly one company_profile row (id pinned to 1). Structured
-- per-exchange memberships live in company_memberships.

CREATE TABLE IF NOT EXISTS company_profile (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Identity & statutory
  trade_name            TEXT NOT NULL,
  legal_name            TEXT,
  entity_type           TEXT,          -- proprietorship | partnership | llp | private_limited | public_limited
  date_of_incorporation DATE,
  founded_year          INTEGER,
  cin                   TEXT,
  pan                   TEXT,
  gstin                 TEXT,
  tan                   TEXT,
  sebi_reg_no           TEXT,
  logo_ref              TEXT,           -- object-storage key

  -- Addresses & contacts
  registered_address    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {line1,line2,city,state,pincode,country}
  head_office_address   JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone                 TEXT,
  alt_phone             TEXT,
  email                 TEXT,
  website               TEXT,
  support_email         TEXT,
  grievance_email       TEXT,

  -- Compliance & key management personnel
  compliance_officer    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {name,email,phone}
  principal_officer     JSONB NOT NULL DEFAULT '{}'::jsonb,
  key_personnel         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name,role,din,pan,email,phone}]

  -- Depository & banking
  nsdl_dp_id            TEXT,
  cdsl_dp_id            TEXT,
  bank_accounts         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{label,bankName,accountNo,ifsc,branch,type}]

  -- Conventions
  base_currency         TEXT NOT NULL DEFAULT 'INR',
  financial_year_start  TEXT NOT NULL DEFAULT '04-01',       -- MM-DD
  timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            BIGINT
);

CREATE TABLE IF NOT EXISTS company_memberships (
  id                 BIGSERIAL PRIMARY KEY,
  exchange           TEXT NOT NULL,                 -- NSE | BSE | MCX | NCDEX | MSEI
  membership_type    TEXT,                          -- TM | SCM | PCM | TM-CM
  trading_member_id  TEXT,
  clearing_member_id TEXT,
  cm_code            TEXT,
  registration_no    TEXT,                          -- SEBI segment registration
  segments           TEXT[] NOT NULL DEFAULT '{}',  -- CASH | FNO | CURRENCY | COMMODITY | DEBT | SLB
  active             BOOLEAN NOT NULL DEFAULT true,
  effective_from     DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_memberships_exchange ON company_memberships (exchange);
