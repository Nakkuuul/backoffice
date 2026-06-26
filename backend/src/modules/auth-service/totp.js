import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../../config/index.js';
import { encryptSecret, decryptSecret } from '../../shared/utils/crypto.js';

// Accept ±N time-steps of clock drift (configurable).
authenticator.options = { window: config.auth.twoFactor.window };

/** Generate a fresh base32 TOTP secret. */
export function generateSecret() {
  return authenticator.generateSecret();
}

/** Build the otpauth:// URI an authenticator app scans. */
export function otpauthUrl(email, secret) {
  return authenticator.keyuri(email, config.auth.twoFactor.issuer, secret);
}

/** Render the otpauth URI as a PNG data URL (for an <img src>). */
export function qrDataUrl(otpauth) {
  return QRCode.toDataURL(otpauth, { margin: 1, width: 240 });
}

/** Verify a 6-digit TOTP code against a secret. */
export function verifyTotp(secret, token) {
  if (!secret || !token) return false;
  try {
    return authenticator.verify({ token: String(token).replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

/* ── Secret-at-rest: pack the AES-GCM parts into one TEXT value ──────────────── */

export function packSecret(secret) {
  const { iv, tag, cipher } = encryptSecret(secret, config.auth.encKey);
  return [iv.toString('base64'), tag.toString('base64'), cipher.toString('base64')].join(':');
}

export function unpackSecret(packed) {
  if (!packed) return null;
  try {
    const [iv, tag, cipher] = packed.split(':');
    return decryptSecret(
      {
        iv: Buffer.from(iv, 'base64'),
        tag: Buffer.from(tag, 'base64'),
        cipher: Buffer.from(cipher, 'base64'),
      },
      config.auth.encKey,
    );
  } catch {
    // Corrupt/tampered ciphertext or wrong key → treat as "no usable secret"
    // rather than throwing an unhandled 500 (which would log internals).
    return null;
  }
}

/* ── Recovery codes ──────────────────────────────────────────────────────────── */

const normalize = (c) => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Human-friendly one-time codes, e.g. "A1B2C-D3E4F-G5H6I". 8 random bytes
 * (64 bits) each — far beyond any precomputation/rainbow-table feasibility.
 */
export function generateRecoveryCodes(n = config.auth.twoFactor.recoveryCodes) {
  const codes = [];
  for (let i = 0; i < n; i += 1) {
    const raw = crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10)}`);
  }
  return codes;
}

/**
 * SHA-256 of the normalized code (dash/case-insensitive). Unsalted is correct
 * here: the codes are high-entropy (64-bit) random tokens looked up BY hash —
 * the same pattern used for refresh tokens — so a per-code salt would break the
 * lookup without adding meaningful protection.
 */
export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(normalize(code)).digest('hex');
}
