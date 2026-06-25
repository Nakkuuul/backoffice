/**
 * Generate a DKIM RSA keypair and print the DNS TXT record to publish.
 *   node scripts/gen-dkim.mjs [selector] [domain]
 *
 * Writes the private key to secrets/dkim-<selector>.pem (gitignored) and prints
 * the public record for DNS. Point DKIM_PRIVATE_KEY_PATH at the written file.
 */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const selector = process.argv[2] || 's1';
const domain = process.argv[3] || 'example.com';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

mkdirSync('secrets', { recursive: true });
const keyPath = path.join('secrets', `dkim-${selector}.pem`);
writeFileSync(keyPath, privateKey, { mode: 0o600 });

// DNS TXT value is the base64 body of the public key (no PEM header/footer).
const pubB64 = publicKey
  .replace(/-----BEGIN PUBLIC KEY-----/, '')
  .replace(/-----END PUBLIC KEY-----/, '')
  .replace(/\s+/g, '');

console.log(`\nPrivate key written to: ${keyPath}`);
console.log(`Set in .env:`);
console.log(`  DKIM_ENABLED=true`);
console.log(`  DKIM_SELECTOR=${selector}`);
console.log(`  DKIM_DOMAIN=${domain}`);
console.log(`  DKIM_PRIVATE_KEY_PATH=${keyPath.replace(/\\/g, '/')}`);
console.log(`\nPublish this DNS TXT record:`);
console.log(`  Host: ${selector}._domainkey.${domain}`);
console.log(`  Value: v=DKIM1; k=rsa; p=${pubB64}`);
console.log(`\nAlso publish (if not already):`);
console.log(`  SPF   @           TXT  "v=spf1 include:<your-relay-spf> -all"`);
console.log(`  DMARC _dmarc      TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; adkim=s; aspf=s"`);
