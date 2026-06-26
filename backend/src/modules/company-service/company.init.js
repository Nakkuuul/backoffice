import { logger } from '../../shared/utils/logger.js';
import { ensureCompany } from './company.service.js';

/** Seed the singleton company profile (+ example memberships) on first boot. */
export async function initCompanyService() {
  const res = await ensureCompany();
  if (res.created) {
    logger.warn('company: seeded default company profile — review & edit under Masters → Company Info.');
  } else {
    logger.info('company: profile already present');
  }
}
