import { z } from 'zod';
import {
  ENTITY_TYPES,
  EXCHANGES,
  SEGMENTS,
  MEMBERSHIP_TYPES,
  DEPOSITORIES,
  DP_MODES,
  CLEARING_MODES,
} from './broker-info.constants.js';

const optEmail = z.union([z.email(), z.literal('')]).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');

// Details of a third-party provider (DP or clearing member) when not self.
const thirdPartyDpSchema = z
  .object({
    name: z.string().max(200).optional(),
    dpId: z.string().max(20).optional(),
    sebiRegNo: z.string().max(40).optional(),
    contactPerson: z.string().max(160).optional(),
    email: optEmail,
    phone: z.string().max(32).optional(),
    agreementRef: z.string().max(80).optional(),
  })
  .strict();

const thirdPartyClearerSchema = z
  .object({
    name: z.string().max(200).optional(),
    clearingMemberId: z.string().max(40).optional(),
    cmCode: z.string().max(40).optional(),
    sebiRegNo: z.string().max(40).optional(),
    contactPerson: z.string().max(160).optional(),
    email: optEmail,
    phone: z.string().max(32).optional(),
    agreementRef: z.string().max(80).optional(),
  })
  .strict();

// Depository participation: self-DP or a procured third-party DP.
const depositorySchema = z
  .object({
    depository: z.enum(DEPOSITORIES),
    mode: z.enum(DP_MODES),
    dpId: z.string().max(20).optional(),
    dpName: z.string().max(200).optional(),
    sebiRegNo: z.string().max(40).optional(),
    active: z.boolean().optional(),
    thirdParty: thirdPartyDpSchema.optional(),
  })
  .strict();

const addressSchema = z
  .object({
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    pincode: z.string().max(12).optional(),
    country: z.string().max(80).optional(),
  })
  .strict();

const personSchema = z
  .object({
    name: z.string().max(160).optional(),
    email: optEmail,
    phone: z.string().max(32).optional(),
  })
  .strict();

const kmpSchema = z.array(
  z
    .object({
      name: z.string().min(1).max(160),
      role: z.string().max(80).optional(),
      din: z.string().max(20).optional(),
      pan: z.string().max(10).optional(),
      email: optEmail,
      phone: z.string().max(32).optional(),
    })
    .strict(),
);

const bankSchema = z.array(
  z
    .object({
      label: z.string().max(80).optional(),
      bankName: z.string().min(1).max(160),
      accountNo: z.string().min(1).max(40),
      ifsc: z.string().max(15).optional(),
      branch: z.string().max(160).optional(),
      type: z.enum(['own', 'settlement', 'client', 'pool']).optional(),
    })
    .strict(),
);

/** PUT /company — partial update of the singleton profile (at least one field). */
export const updateCompanySchema = z
  .object({
    tradeName: z.string().min(1).max(200).optional(),
    legalName: z.string().max(200).optional(),
    entityType: z.enum(ENTITY_TYPES).optional(),
    dateOfIncorporation: isoDate.optional(),
    foundedYear: z.coerce.number().int().min(1800).max(2100).optional(),
    cin: z.string().max(30).optional(),
    pan: z.string().max(10).optional(),
    gstin: z.string().max(15).optional(),
    tan: z.string().max(15).optional(),
    sebiRegNo: z.string().max(40).optional(),
    logoRef: z.string().max(1024).optional(),

    registeredAddress: addressSchema.optional(),
    headOfficeAddress: addressSchema.optional(),
    phone: z.string().max(32).optional(),
    altPhone: z.string().max(32).optional(),
    email: optEmail,
    website: z.union([z.url(), z.literal('')]).optional(),
    supportEmail: optEmail,
    grievanceEmail: optEmail,

    complianceOfficer: personSchema.optional(),
    principalOfficer: personSchema.optional(),
    keyPersonnel: kmpSchema.optional(),

    depositories: z.array(depositorySchema).optional(),
    bankAccounts: bankSchema.optional(),

    baseCurrency: z.string().max(8).optional(),
    financialYearStart: z.string().regex(/^\d{2}-\d{2}$/, 'use MM-DD').optional(),
    timezone: z.string().max(64).optional(),
  })
  .refine((o) => Object.keys(o).length >= 1, { message: 'Provide at least one field to update' });

export const membershipCreateSchema = z.object({
  exchange: z.enum(EXCHANGES),
  membershipType: z.enum(MEMBERSHIP_TYPES).optional(),
  tradingMemberId: z.string().max(40).optional(),
  // Clearing: self → broker's own clearingMemberId/cmCode; third_party → thirdPartyClearer.
  clearingMode: z.enum(CLEARING_MODES).optional(),
  clearingMemberId: z.string().max(40).optional(),
  cmCode: z.string().max(40).optional(),
  thirdPartyClearer: thirdPartyClearerSchema.optional(),
  registrationNo: z.string().max(40).optional(),
  segments: z.array(z.enum(SEGMENTS)).optional(),
  active: z.boolean().optional(),
  effectiveFrom: isoDate.optional(),
  notes: z.string().max(1000).optional(),
});

export const membershipUpdateSchema = z
  .object({
    exchange: z.enum(EXCHANGES).optional(),
    membershipType: z.enum(MEMBERSHIP_TYPES).optional(),
    tradingMemberId: z.string().max(40).optional(),
    clearingMode: z.enum(CLEARING_MODES).optional(),
    clearingMemberId: z.string().max(40).optional(),
    cmCode: z.string().max(40).optional(),
    thirdPartyClearer: thirdPartyClearerSchema.optional(),
    registrationNo: z.string().max(40).optional(),
    segments: z.array(z.enum(SEGMENTS)).optional(),
    active: z.boolean().optional(),
    effectiveFrom: isoDate.optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((o) => Object.keys(o).length >= 1, { message: 'Provide at least one field to update' });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
