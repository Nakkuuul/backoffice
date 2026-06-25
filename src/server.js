import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './shared/utils/logger.js';
import { pool } from './db/pool.js';
import { initEmailService, stopEmailService } from './modules/email-service/email.init.js';

/**
 * Process entry point. Boots the HTTP server and wires graceful shutdown.
 */
async function start() {
  const app = createApp();

  // Wire email-service into esign-service and (optionally) start the in-process
  // outbox worker. Disable the worker here and run a separate fleet at scale.
  initEmailService();

  const server = app.listen(config.app.port, config.app.host, () => {
    logger.info(
      `${config.app.name} listening on http://${config.app.host}:${config.app.port} [${config.env}]`,
    );
  });

  // Graceful shutdown — stop workers, drain HTTP, then close the DB pool.
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await stopEmailService();
    server.close(async () => {
      await pool.end();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force-exit if cleanup hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

start();
