-- 014_company_dp_clearing.sql — depository participation (self vs third-party DP)
-- and per-exchange clearing mode (self-clearing vs third-party clearing member).

-- Depository participation becomes a structured list (a broker can be self-DP
-- for one depository and use a third-party DP for another). Replaces the flat
-- nsdl_dp_id / cdsl_dp_id fields.
--   [{ depository, mode, dpId, dpName, sebiRegNo, active, thirdParty: {...} }]
ALTER TABLE company_profile
  DROP COLUMN IF EXISTS nsdl_dp_id,
  DROP COLUMN IF EXISTS cdsl_dp_id,
  ADD COLUMN IF NOT EXISTS depositories JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Clearing per membership: self-clearing uses the broker's own clearing_member_id
-- / cm_code; third-party clearing stores the clearer's details in JSONB.
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS clearing_mode TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS third_party_clearer JSONB NOT NULL DEFAULT '{}'::jsonb;
