import { logger } from '../../shared/utils/logger.js';
import { ensureCompany } from './broker-info.service.js';

/** Seed the singleton broker-info profile (+ example memberships) on first boot. */
export async function initBrokerInfoService() {
  const res = await ensureCompany();
  if (res.created) {
    logger.warn('broker-info: seeded default broker profile — review & edit under Masters → Company Info.');
  } else {
    logger.info('broker-info: profile already present');
  }
}
