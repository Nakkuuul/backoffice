import { query } from '../../db/pool.js';

const SCALAR = {
  tradeName: 'trade_name',
  legalName: 'legal_name',
  entityType: 'entity_type',
  dateOfIncorporation: 'date_of_incorporation',
  foundedYear: 'founded_year',
  cin: 'cin',
  pan: 'pan',
  gstin: 'gstin',
  tan: 'tan',
  sebiRegNo: 'sebi_reg_no',
  logoRef: 'logo_ref',
  phone: 'phone',
  altPhone: 'alt_phone',
  email: 'email',
  website: 'website',
  supportEmail: 'support_email',
  grievanceEmail: 'grievance_email',
  baseCurrency: 'base_currency',
  financialYearStart: 'financial_year_start',
  timezone: 'timezone',
};

const JSONB = {
  registeredAddress: 'registered_address',
  headOfficeAddress: 'head_office_address',
  complianceOfficer: 'compliance_officer',
  principalOfficer: 'principal_officer',
  keyPersonnel: 'key_personnel',
  depositories: 'depositories',
  bankAccounts: 'bank_accounts',
};

export async function getProfile() {
  const { rows } = await query(`SELECT * FROM company_profile WHERE id = 1`);
  return rows[0] ?? null;
}

/** Seed the singleton profile if absent. */
export async function seedProfile(defaults) {
  const { rows } = await query(
    `INSERT INTO company_profile (id, trade_name, legal_name, entity_type, email, website, support_email, grievance_email)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      defaults.tradeName,
      defaults.legalName ?? null,
      defaults.entityType ?? null,
      defaults.email ?? null,
      defaults.website ?? null,
      defaults.supportEmail ?? null,
      defaults.grievanceEmail ?? null,
    ],
  );
  return rows[0] ?? null; // null = already existed
}

export async function updateProfile(fields, updatedBy) {
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(SCALAR)) {
    if (fields[key] !== undefined) {
      vals.push(fields[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  for (const [key, col] of Object.entries(JSONB)) {
    if (fields[key] !== undefined) {
      vals.push(JSON.stringify(fields[key]));
      sets.push(`${col} = $${vals.length}::jsonb`);
    }
  }
  if (sets.length === 0) return getProfile();
  vals.push(updatedBy ?? null);
  sets.push(`updated_by = $${vals.length}`);
  sets.push(`updated_at = now()`);
  const { rows } = await query(`UPDATE company_profile SET ${sets.join(', ')} WHERE id = 1 RETURNING *`, vals);
  return rows[0];
}

/* ── Memberships ───────────────────────────────────────────────────────────── */

const M_MAP = {
  exchange: 'exchange',
  membershipType: 'membership_type',
  tradingMemberId: 'trading_member_id',
  clearingMode: 'clearing_mode',
  clearingMemberId: 'clearing_member_id',
  cmCode: 'cm_code',
  registrationNo: 'registration_no',
  segments: 'segments',
  active: 'active',
  effectiveFrom: 'effective_from',
  notes: 'notes',
};

export async function listMemberships() {
  const { rows } = await query(`SELECT * FROM company_memberships ORDER BY exchange, id`);
  return rows;
}

export async function findMembership(id) {
  const { rows } = await query(`SELECT * FROM company_memberships WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createMembership(input) {
  const { rows } = await query(
    `INSERT INTO company_memberships
       (exchange, membership_type, trading_member_id, clearing_mode, clearing_member_id, cm_code,
        third_party_clearer, registration_no, segments, active, effective_from, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12) RETURNING *`,
    [
      input.exchange,
      input.membershipType ?? null,
      input.tradingMemberId ?? null,
      input.clearingMode ?? 'self',
      input.clearingMemberId ?? null,
      input.cmCode ?? null,
      JSON.stringify(input.thirdPartyClearer ?? {}),
      input.registrationNo ?? null,
      input.segments ?? [],
      input.active ?? true,
      input.effectiveFrom ?? null,
      input.notes ?? null,
    ],
  );
  return rows[0];
}

export async function updateMembership(id, fields) {
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(M_MAP)) {
    if (fields[key] !== undefined) {
      vals.push(fields[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (fields.thirdPartyClearer !== undefined) {
    vals.push(JSON.stringify(fields.thirdPartyClearer));
    sets.push(`third_party_clearer = $${vals.length}::jsonb`);
  }
  if (sets.length === 0) return findMembership(id);
  sets.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await query(
    `UPDATE company_memberships SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
    vals,
  );
  return rows[0] ?? null;
}

export async function deleteMembership(id) {
  const { rowCount } = await query(`DELETE FROM company_memberships WHERE id = $1`, [id]);
  return rowCount > 0;
}
