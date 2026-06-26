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
    // Public base URL of the frontend (used to build password-reset links, etc.).
    publicUrl: (process.env.APP_PUBLIC_URL || 'http://localhost:3001').replace(/\/$/, ''),
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
    // Access JWT lifetime (short in real use; defaults to the legacy value).
    accessTtl: process.env.AUTH_ACCESS_TTL || process.env.JWT_EXPIRES_IN || '1d',
    // Refresh-token lifetime (revocable session stored in auth_sessions).
    refreshTtl: process.env.AUTH_REFRESH_TTL || '30d',
    // Interim "login challenge" token lifetime (password-change / 2FA steps).
    challengeTtl: process.env.AUTH_CHALLENGE_TTL || '10m',
    // AES-256 key (base64, 32 bytes) for encrypting TOTP secrets at rest.
    // Falls back to the eSign key so dev works without extra config.
    encKey: process.env.AUTH_ENC_KEY || process.env.ESIGN_ENC_KEY || '',
    // Two-factor authentication (TOTP / authenticator app).
    twoFactor: {
      enabled: process.env.AUTH_2FA_ENABLED ? toBool(process.env.AUTH_2FA_ENABLED) : true,
      issuer: process.env.AUTH_2FA_ISSUER || 'Sapphire Broking',
      window: Number(process.env.AUTH_2FA_WINDOW || 1), // accepted ± time-steps (clock drift)
      recoveryCodes: Number(process.env.AUTH_2FA_RECOVERY_CODES || 10),
    },
    // Master user, seeded on first boot when no super_admin exists. Created with
    // must_change_password=true so its first login forces a password reset.
    master: {
      email: process.env.AUTH_MASTER_EMAIL || 'admin@sapphirebroking.net',
      password: process.env.AUTH_MASTER_PASSWORD || 'ChangeMe@Master1',
      name: process.env.AUTH_MASTER_NAME || 'Master Administrator',
    },
    // "Forgot access" / password reset. Link tokens are 256-bit; OTPs are
    // 6-digit, short-lived, single-use and attempt-limited.
    passwordReset: {
      linkTtl: process.env.AUTH_RESET_LINK_TTL || '30m',
      otpTtl: process.env.AUTH_RESET_OTP_TTL || '10m',
      otpMaxAttempts: Number(process.env.AUTH_RESET_OTP_MAX_ATTEMPTS || 5),
      // Max reset requests per user within the window (server-side throttle, in
      // addition to the per-IP rate limiter). Excess requests are silently dropped.
      maxRequestsPerWindow: Number(process.env.AUTH_RESET_MAX_REQUESTS || 5),
      requestWindowMs: Number(process.env.AUTH_RESET_WINDOW_MS || 15 * 60 * 1000),
    },
  },

  sms: {
    // Outbound SMS provider for OTP delivery. 'stub' logs only (no on-prem SMS
    // gateway yet); swap for a real provider (MSG91 / Twilio / Gupshup) later.
    provider: process.env.SMS_PROVIDER || 'stub',
    senderId: process.env.SMS_SENDER_ID || 'SAPPHB',
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

  email: {
    // Default envelope/header identity. From should be on the authenticated domain.
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Broker Backoffice',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    // Domain used for Message-ID and (with DKIM) alignment.
    domain: process.env.EMAIL_DOMAIN || 'example.com',
    // One-click unsubscribe target (List-Unsubscribe). Strongly recommended for bulk.
    unsubscribeUrl: process.env.EMAIL_UNSUBSCRIBE_URL || '',

    // SMTP relay (nodemailer). Point at your MTA or a provider's SMTP endpoint.
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      secure: toBool(process.env.SMTP_SECURE), // true for 465, false for 587 (STARTTLS)
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      // Connection pooling for throughput.
      maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
      maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
      // Cap messages/sec per process to respect relay/ISP throttles (0 = unlimited).
      rateLimit: Number(process.env.SMTP_RATE_LIMIT || 0),
      // Reject invalid/self-signed TLS certs (default true). Set false only for
      // a relay with a self-signed cert you trust (e.g. an internal MTA).
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED
        ? toBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED)
        : true,
    },

    // DKIM signing (the biggest deliverability lever the app controls).
    dkim: {
      enabled: toBool(process.env.DKIM_ENABLED),
      domainName: process.env.DKIM_DOMAIN || process.env.EMAIL_DOMAIN || '',
      keySelector: process.env.DKIM_SELECTOR || 's1',
      privateKeyPath: process.env.DKIM_PRIVATE_KEY_PATH || '',
    },

    // Inbound mail (bounces/complaints/replies) forwarded from the MTA.
    // The MTA must present this shared secret to POST /email/inbound.
    inboundSecret: process.env.EMAIL_INBOUND_SECRET || '',

    // Outbox worker pool.
    worker: {
      enabled: process.env.EMAIL_WORKER_ENABLED ? toBool(process.env.EMAIL_WORKER_ENABLED) : true,
      concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY || 4),
      batchSize: Number(process.env.EMAIL_BATCH_SIZE || 50),
      pollIntervalMs: Number(process.env.EMAIL_POLL_INTERVAL_MS || 1000),
      maxAttempts: Number(process.env.EMAIL_MAX_ATTEMPTS || 6),
    },
  },

  ekyc: {
    // Verification provider backend (stub | nsdl | … later).
    provider: process.env.KYC_PROVIDER || 'stub',
    // Shared secret the frontoffice/onboarding portal presents to push
    // applicants into the backoffice (POST /ekyc/intake).
    intakeSecret: process.env.EKYC_INTAKE_SECRET || '',
  },

  documents: {
    // Path to the qpdf binary (compression + encrypt/decrypt). On Linux on-prem
    // this is just 'qpdf' after `apt install qpdf`; on Windows point at the exe.
    qpdfBin: process.env.QPDF_BIN || 'qpdf',
    // AES key length for locking (40 | 128 | 256). 256 = AES-256 (recommended).
    encryptionBits: Number(process.env.PDF_ENCRYPTION_BITS || 256),
  },

  storage: {
    // 's3' (MinIO/S3-compatible, recommended) or 'local' (plain disk fallback).
    driver: process.env.STORAGE_DRIVER || 's3',
    local: {
      dir: process.env.STORAGE_LOCAL_DIR || 'storage-data',
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:9000',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY || 'backoffice',
      secretAccessKey: process.env.S3_SECRET_KEY || 'backoffice_secret',
      bucket: process.env.S3_BUCKET || 'backoffice',
      // MinIO needs path-style addressing (bucket in the path, not the host).
      forcePathStyle: true,
    },
  },

  reports: {
    // Generated files go to the shared object store (src/shared/storage).
    // Bulk generation worker.
    worker: {
      enabled: process.env.REPORTS_WORKER_ENABLED ? toBool(process.env.REPORTS_WORKER_ENABLED) : true,
      concurrency: Number(process.env.REPORTS_WORKER_CONCURRENCY || 2),
      batchSize: Number(process.env.REPORTS_BATCH_SIZE || 10),
      pollIntervalMs: Number(process.env.REPORTS_POLL_INTERVAL_MS || 1500),
    },
    // Puppeteer launch flags (Chromium). --no-sandbox is needed in many
    // container/on-prem setups.
    puppeteerArgs: (process.env.REPORTS_PUPPETEER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(','),
  },
};
