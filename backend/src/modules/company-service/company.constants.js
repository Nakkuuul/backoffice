export const ENTITY_TYPES = [
  'proprietorship',
  'partnership',
  'llp',
  'private_limited',
  'public_limited',
];

export const EXCHANGES = ['NSE', 'BSE', 'MCX', 'NCDEX', 'MSEI'];

export const SEGMENTS = ['CASH', 'FNO', 'CURRENCY', 'COMMODITY', 'DEBT', 'SLB'];

export const MEMBERSHIP_TYPES = ['TM', 'SCM', 'PCM', 'TM-CM'];

export const DEPOSITORIES = ['NSDL', 'CDSL'];

// How the broker participates in a depository: as its own DP (self) or by
// procuring a third-party DP's services.
export const DP_MODES = ['self', 'third_party'];

// Clearing for an exchange membership: the broker self-clears, or clears through
// a third-party clearing member / custodian.
export const CLEARING_MODES = ['self', 'third_party'];
