import { NotFoundError } from '../../shared/errors/AppError.js';
import * as repo from './company.repository.js';

const ymd = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

function publicProfile(row) {
  return {
    tradeName: row.trade_name,
    legalName: row.legal_name,
    entityType: row.entity_type,
    dateOfIncorporation: ymd(row.date_of_incorporation),
    foundedYear: row.founded_year,
    cin: row.cin,
    pan: row.pan,
    gstin: row.gstin,
    tan: row.tan,
    sebiRegNo: row.sebi_reg_no,
    logoRef: row.logo_ref,
    registeredAddress: row.registered_address ?? {},
    headOfficeAddress: row.head_office_address ?? {},
    phone: row.phone,
    altPhone: row.alt_phone,
    email: row.email,
    website: row.website,
    supportEmail: row.support_email,
    grievanceEmail: row.grievance_email,
    complianceOfficer: row.compliance_officer ?? {},
    principalOfficer: row.principal_officer ?? {},
    keyPersonnel: row.key_personnel ?? [],
    nsdlDpId: row.nsdl_dp_id,
    cdslDpId: row.cdsl_dp_id,
    bankAccounts: row.bank_accounts ?? [],
    baseCurrency: row.base_currency,
    financialYearStart: row.financial_year_start,
    timezone: row.timezone,
    updatedAt: row.updated_at,
  };
}

function publicMembership(row) {
  return {
    id: Number(row.id),
    exchange: row.exchange,
    membershipType: row.membership_type,
    tradingMemberId: row.trading_member_id,
    clearingMemberId: row.clearing_member_id,
    cmCode: row.cm_code,
    registrationNo: row.registration_no,
    segments: row.segments ?? [],
    active: row.active,
    effectiveFrom: ymd(row.effective_from),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The full company profile + memberships (+ derived union of active segments). */
export async function getCompany() {
  const row = await repo.getProfile();
  if (!row) throw new NotFoundError('Company profile not initialised');
  const memberships = (await repo.listMemberships()).map(publicMembership);
  const activeSegments = [
    ...new Set(memberships.filter((m) => m.active).flatMap((m) => m.segments)),
  ];
  return { profile: publicProfile(row), memberships, activeSegments };
}

export async function updateCompany(fields, { updatedBy } = {}) {
  const row = await repo.getProfile();
  if (!row) throw new NotFoundError('Company profile not initialised');
  return publicProfile(await repo.updateProfile(fields, updatedBy));
}

export async function addMembership(input) {
  return publicMembership(await repo.createMembership(input));
}

export async function updateMembership(id, fields) {
  const row = await repo.updateMembership(id, fields);
  if (!row) throw new NotFoundError('Membership not found');
  return publicMembership(row);
}

export async function removeMembership(id) {
  const ok = await repo.deleteMembership(id);
  if (!ok) throw new NotFoundError('Membership not found');
}

/** Seed the singleton profile + example memberships on first boot (idempotent). */
export async function ensureCompany() {
  const seeded = await repo.seedProfile({
    tradeName: 'Sapphire Broking',
    legalName: 'Sapphire Broking Private Limited',
    entityType: 'private_limited',
    email: 'info@sapphirebroking.net',
    website: 'https://sapphirebroking.net',
    supportEmail: 'support@sapphirebroking.net',
    grievanceEmail: 'grievance@sapphirebroking.net',
  });
  if (!seeded) return { created: false };

  // First-time only: a couple of example exchange memberships to fill in.
  await repo.createMembership({ exchange: 'NSE', membershipType: 'TM-CM', segments: ['CASH', 'FNO', 'CURRENCY'], active: true });
  await repo.createMembership({ exchange: 'BSE', membershipType: 'TM-CM', segments: ['CASH', 'FNO'], active: true });
  return { created: true };
}
