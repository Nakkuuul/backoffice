import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { registerReport } from './registry.js';
import { ReportsWorker } from './reports.worker.js';
import { closePdfRenderer } from './renderers/index.js';

// Register report definitions. Add new broker reports here (one import each).
import clientLedger from './definitions/client-ledger.js';

let worker;

export function initReportsService({ startWorker = true } = {}) {
  registerReport(clientLedger);
  logger.info('reports: registered report definitions');

  if (startWorker && config.reports.worker.enabled) {
    worker = new ReportsWorker();
    worker.start();
  }
  return worker;
}

export async function stopReportsService() {
  if (worker) await worker.stop();
  await closePdfRenderer();
}
