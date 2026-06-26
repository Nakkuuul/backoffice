import { NotFoundError } from '../../shared/errors/AppError.js';
import * as repo from './broker-info.repository.js';

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
    depositories: row.depositories ?? [],
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
    clearingMode: row.clearing_mode,
    clearingMemberId: row.clearing_member_id,
    cmCode: row.cm_code,
    thirdPartyClearer: row.third_party_clearer ?? {},
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
  const profile = publicProfile(row);
  const memberships = (await repo.listMemberships()).map(publicMembership);
  const activeSegments = [
    ...new Set(memberships.filter((m) => m.active).flatMap((m) => m.segments)),
  ];
  // Derived DP nature: none / self / third_party / mixed across active depositories.
  const activeDeps = (profile.depositories ?? []).filter((d) => d.active !== false);
  const dpModes = new Set(activeDeps.map((d) => d.mode));
  const dpMode = activeDeps.length === 0 ? 'none' : dpModes.size > 1 ? 'mixed' : [...dpModes][0];
  return { profile, memberships, activeSegments, dpMode };
}

/**
 * Public, unauthenticated branding for the login screen / tab title. Only
 * brand-safe fields (no contacts, PAN, banking, KMP). Absent fields are null
 * and the frontend hides them.
 */
export async function getPublicBranding() {
  const row = await repo.getProfile();
  if (!row) {
    return { tradeName: null, legalName: null, entityType: null, sebiRegNo: null, foundedYear: null, exchanges: [] };
  }
  const memberships = await repo.listMemberships();
  const exchanges = [...new Set(memberships.filter((m) => m.active).map((m) => m.exchange))];
  return {
    tradeName: row.trade_name,
    legalName: row.legal_name,
    entityType: row.entity_type,
    sebiRegNo: row.sebi_reg_no,
    foundedYear: row.founded_year,
    exchanges,
  };
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

  // First-time only: example depository participation (self-DP on NSDL, third-party
  // DP on CDSL) and exchange memberships (self-clearing on NSE/BSE, third-party
  // clearing on MCX). Admins review & edit these under Masters → Company Info.
  await repo.updateProfile(
    {
      depositories: [
        { depository: 'NSDL', mode: 'self', dpId: 'IN303456', dpName: 'Sapphire Broking Private Limited', sebiRegNo: 'IN-DP-NSDL-2019-001', active: true },
        {
          depository: 'CDSL',
          mode: 'third_party',
          dpId: '12088700',
          active: true,
          thirdParty: { name: 'Globe Capital DP Services Ltd', dpId: '12088700', sebiRegNo: 'IN-DP-CDSL-2014-072', contactPerson: 'Operations Desk', email: 'dp@globecapital.example', phone: '+91 22 4000 0000', agreementRef: 'DP/2019/0042' },
        },
      ],
    },
    null,
  );
  await repo.createMembership({ exchange: 'NSE', membershipType: 'TM-CM', clearingMode: 'self', segments: ['CASH', 'FNO', 'CURRENCY'], active: true });
  await repo.createMembership({ exchange: 'BSE', membershipType: 'TM-CM', clearingMode: 'self', segments: ['CASH', 'FNO'], active: true });
  await repo.createMembership({
    exchange: 'MCX',
    membershipType: 'TM',
    clearingMode: 'third_party',
    segments: ['COMMODITY'],
    active: true,
    thirdPartyClearer: { name: 'Phillip Commodities India', cmCode: 'MCX-CM-118', sebiRegNo: 'INZ000045678', contactPerson: 'Clearing Desk', email: 'clearing@phillip.example', phone: '+91 22 6000 0000', agreementRef: 'CM/2021/0117' },
  });
  return { created: true };
}
