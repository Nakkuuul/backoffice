import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized, validated application configuration.
 * Read env vars here ONLY — the rest of the app imports from this module.
 */
function required(key, fallback = undefined) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function toBool(value) {
  return String(value).toLowerCase() === 'true';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  app: {
    name: process.env.APP_NAME || 'backoffice',
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: required('DB_NAME', 'backoffice'),
    user: required('DB_USER', 'backoffice'),
    password: required('DB_PASSWORD', ''),
    max: Number(process.env.DB_POOL_MAX || 10),
    ssl: toBool(process.env.DB_SSL),
  },

  auth: {
    jwtSecret: required('JWT_SECRET', 'dev_only_insecure_secret'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
