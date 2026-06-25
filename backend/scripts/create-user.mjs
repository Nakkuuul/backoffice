/**
 * Create a backoffice user (bootstrap the first super_admin, or any user).
 *   node scripts/create-user.mjs <email> <password> <role> [clientRef] [fullName]
 * e.g. node scripts/create-user.mjs admin@sapphirebroking.net 'StrongPass#1' super_admin
 */
import { pool } from '../src/db/pool.js';
import { createUser } from '../src/modules/user-service/user.service.js';
import { ROLE_NAMES } from '../src/modules/user-service/rbac.js';

const [email, password, role, clientRef, fullName] = process.argv.slice(2);
if (!email || !password || !role) {
  console.error('Usage: node scripts/create-user.mjs <email> <password> <role> [clientRef] [fullName]');
  console.error('Roles:', ROLE_NAMES.join(', '));
  process.exit(1);
}

try {
  const user = await createUser({ email, password, role, clientRef, fullName: fullName || email });
  console.log('✅ created user:', user);
} catch (err) {
  console.error('❌', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
