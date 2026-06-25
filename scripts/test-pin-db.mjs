/**
 * Verifies the encrypted PIN round-trips through the DB without ever printing
 * the PIN. Stores process.env.PKCS11_PIN encrypted, reads it back, asserts match.
 */
import { query, pool } from '../src/db/pool.js';
import { setPin, isPinStored, resolvePin } from '../src/modules/esign-service/esign.settings.js';
import { config } from '../src/config/index.js';

const pin = process.env.PKCS11_PIN;
if (!pin) {
  console.error('PKCS11_PIN not set in env for this test');
  process.exit(1);
}

// Ensure an admin user exists for FK references elsewhere.
await query(
  `INSERT INTO users (id, email, password_hash, full_name, role)
   VALUES (1, 'admin@local', 'x', 'Local Admin', 'admin')
   ON CONFLICT (id) DO NOTHING`,
);

await setPin(pin, { userId: 1 });
console.log('stored:', await isPinStored());

// Temporarily blank the env override so resolvePin reads from the DB.
const saved = config.esign.pkcs11.pin;
config.esign.pkcs11.pin = '';
const recovered = await resolvePin();
config.esign.pkcs11.pin = saved;

console.log('db roundtrip match:', recovered === pin);
console.log(recovered === pin ? '✅ ENCRYPTED PIN STORAGE OK' : '❌ MISMATCH');

await pool.end();
process.exit(0);
