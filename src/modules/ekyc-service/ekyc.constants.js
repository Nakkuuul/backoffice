/** Application kind: new onboarding vs re-verification/modification. */
export const KYC_KIND = Object.freeze({
  EKYC: 'ekyc', // new client onboarding
  REKYC: 'rekyc', // re-verification / detail modification of an existing client
});
export const KYC_KINDS = Object.values(KYC_KIND);

/** Where an application originated. */
export const KYC_SOURCE = Object.freeze({
  BACKOFFICE: 'backoffice',
  FRONTOFFICE: 'frontoffice',
});

/** KYC application workflow states. */
export const KYC_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ON_HOLD: 'on_hold',
});

/** Allowed status transitions (workflow guard). */
export const KYC_TRANSITIONS = Object.freeze({
  draft: ['submitted'],
  submitted: ['in_review', 'on_hold', 'rejected'],
  in_review: ['approved', 'rejected', 'on_hold'],
  on_hold: ['in_review', 'rejected'],
  approved: [],
  rejected: [],
});

/** Verification check types. */
export const CHECK_TYPE = Object.freeze({
  PAN: 'pan',
  AADHAAR: 'aadhaar',
  BANK: 'bank',
  EMAIL: 'email',
  MOBILE: 'mobile',
  SIGNATURE: 'signature',
  PHOTO: 'photo',
  IPV: 'ipv',
  LIVENESS: 'liveness',
});
export const CHECK_TYPES = Object.values(CHECK_TYPE);

export const CHECK_STATUS = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

/** Document types collected during KYC. */
export const DOC_TYPE = Object.freeze({
  PAN_CARD: 'pan_card',
  AADHAAR: 'aadhaar',
  PHOTO: 'photo',
  SIGNATURE: 'signature',
  BANK_PROOF: 'bank_proof',
  CANCELLED_CHEQUE: 'cancelled_cheque',
  OTHER: 'other',
});
export const DOC_TYPES = Object.values(DOC_TYPE);

/** Checks that must pass before an application can be approved. */
export const REQUIRED_CHECKS = [CHECK_TYPE.PAN];
