import pino from 'pino';
import { config } from '../../config/index.js';

/**
 * Application-wide structured logger.
 * Pretty-prints in development; JSON (machine-parseable) in production.
 */
export const logger = pino({
  level: config.app.logLevel,
  base: { app: config.app.name },
  transport: config.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
});
