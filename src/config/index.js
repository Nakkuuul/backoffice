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

  esign: {
    // Master switch. When false, the module loads but signing endpoints
    // report the service as disabled instead of touching the token.
    enabled: toBool(process.env.ESIGN_ENABLED),

    // PKCS#11 access to the physical DSC token.
    pkcs11: {
      // Absolute path to the token vendor's PKCS#11 module.
      //   SafeNet eToken : C:\Windows\System32\eTPKCS11.dll
      //   WatchData      : C:\Windows\System32\Wdpkcs.dll
      //   ePass2003      : C:\Windows\System32\eps2003csp11.dll
      libPath: process.env.PKCS11_LIB_PATH || '',
      // Token PIN. Keep in a secret store / env, never commit.
      pin: process.env.PKCS11_PIN || '',
      // Optional: pin to a specific slot index; otherwise first slot with a token.
      slot: process.env.PKCS11_SLOT ? Number(process.env.PKCS11_SLOT) : undefined,
      // Optional: select a specific signing cert/key on the token by label or id.
      certLabel: process.env.PKCS11_CERT_LABEL || undefined,
    },

    // AES-256 key (base64, 32 bytes) for encrypting the DSC PIN at rest.
    // When set, the PIN can be stored in the DB so operators aren't prompted.
    encKey: process.env.ESIGN_ENC_KEY || '',

    // Visible signature appearance on the PDF (PAdES).
    appearance: {
      reason: process.env.ESIGN_REASON || 'Digitally signed by broker backoffice',
      location: process.env.ESIGN_LOCATION || '',
      contactInfo: process.env.ESIGN_CONTACT || '',
      // Draw a visible stamp on the page (vs. an invisible signature).
      visible: process.env.ESIGN_VISIBLE ? toBool(process.env.ESIGN_VISIBLE) : true,
      // Which page to stamp ('first' | 'last') and corner of the page.
      page: process.env.ESIGN_STAMP_PAGE || 'first',
      corner: process.env.ESIGN_STAMP_CORNER || 'bottom-right', // bottom-right|bottom-left|top-right|top-left
    },
  },
};
