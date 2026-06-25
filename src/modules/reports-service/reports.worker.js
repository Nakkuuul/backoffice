import os from 'node:os';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import * as repo from './reports.repository.js';
import { runJob } from './reports.service.js';

/**
 * Bulk report worker. Claims pending jobs with SKIP LOCKED and generates them.
 * Run more instances (or raise concurrency) to scale a large nightly run; the
 * shared Chromium instance is reused across renders within a process.
 */
export class ReportsWorker {
  constructor() {
    this.id = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
    this.running = false;
    this.loops = [];
  }

  start() {
    if (this.running) return;
    this.running = true;
    const { concurrency } = config.reports.worker;
    logger.info({ workerId: this.id, concurrency }, 'reports: worker starting');
    for (let i = 0; i < concurrency; i++) this.loops.push(this.#loop(i));
  }

  async stop() {
    this.running = false;
    await Promise.allSettled(this.loops);
    this.loops = [];
  }

  async #loop(slot) {
    const { batchSize, pollIntervalMs } = config.reports.worker;
    while (this.running) {
      try {
        const batch = await repo.claimBatch(this.id, batchSize);
        if (batch.length === 0) {
          await sleep(pollIntervalMs + slot * 50);
          continue;
        }
        for (const row of batch) {
          if (!this.running) break;
          try {
            await runJob(row);
          } catch (err) {
            await repo.markFailed(row.id, truncate(err.message, 2000), {
              attempts: row.attempts,
              maxAttempts: row.max_attempts,
            });
            logger.warn({ id: row.id, err: err.message }, 'reports: job failed');
          }
        }
      } catch (err) {
        logger.error({ err, workerId: this.id }, 'reports: worker loop error');
        await sleep(pollIntervalMs);
      }
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) : s);
