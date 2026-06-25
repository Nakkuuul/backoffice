import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { encryptSecret, decryptSecret } from '../../shared/utils/crypto.js';
import { Pkcs11NotConfiguredError } from './signer/errors.js';

/**
 * Persistence + resolution of the DSC token PIN.
 *
 * The PIN is encrypted (AES-256-GCM) before it touches the DB, so operators
 * configure it once and aren't prompted on every signing call. Resolution
 * order at signing time:
 *   1. PKCS11_PIN env var (useful for the initial bring-up / CI)
 *   2. encrypted PIN stored in esign_settings
 */

/** Store/replace the PIN, encrypted. */
export async function setPin(pin, { userId } = {}) {
  const { iv, tag, cipher } = encryptSecret(pin, config.esign.encKey);
  await query(
    `UPDATE esign_settings
       SET pin_iv = $1, pin_tag = $2, pin_cipher = $3,
           pin_set_by = $4, pin_set_at = now(), updated_at = now()
     WHERE id = 1`,
    [iv, tag, cipher, userId ?? null],
  );
}

/** @returns {Promise<boolean>} whether a PIN is stored. */
export async function isPinStored() {
  const { rows } = await query(`SELECT pin_cipher FROM esign_settings WHERE id = 1`);
  return Boolean(rows[0]?.pin_cipher);
}

/** Remove the stored PIN. */
export async function clearPin() {
  await query(
    `UPDATE esign_settings
       SET pin_iv = NULL, pin_tag = NULL, pin_cipher = NULL,
           pin_set_by = NULL, pin_set_at = NULL, updated_at = now()
     WHERE id = 1`,
  );
}

/**
 * Resolve the PIN for a signing operation. The encrypted DB value is the
 * primary source; PKCS11_PIN env var is the fallback (e.g. for bring-up, CI,
 * or if the DB row is cleared).
 */
export async function resolvePin() {
  const { rows } = await query(
    `SELECT pin_iv, pin_tag, pin_cipher FROM esign_settings WHERE id = 1`,
  );
  const row = rows[0];
  if (row?.pin_cipher) {
    return decryptSecret(
      { iv: row.pin_iv, tag: row.pin_tag, cipher: row.pin_cipher },
      config.esign.encKey,
    );
  }

  // Fallback to env.
  if (config.esign.pkcs11.pin) return config.esign.pkcs11.pin;

  throw new Pkcs11NotConfiguredError(
    'No DSC PIN available — set it via POST /esign/config/pin or PKCS11_PIN',
  );
}
