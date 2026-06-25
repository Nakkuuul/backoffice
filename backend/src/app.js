import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';

import { config } from './config/index.js';
import { logger } from './shared/utils/logger.js';
import apiRoutes from './api/routes/index.js';
import { notFound } from './api/middlewares/notFound.js';
import { errorHandler } from './api/middlewares/errorHandler.js';

/**
 * Builds and returns the configured Express application.
 * Kept free of side effects (no listen / no DB connect) so it is testable.
 */
export function createApp() {
  const app = express();

  // Trust the reverse proxy (nginx) typically fronting the local-server deploy.
  app.set('trust proxy', true);

  // Security & infra middleware
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));

  // API
  app.use('/api/v1', apiRoutes);

  // 404 + centralized error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
