import graphene from 'graphene-pk11';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';
import { parseCertificate } from './cms.js';
import {
  Pkcs11NotConfiguredError,
  TokenUnavailableError,
  EsignDisabledError,
} from './errors.js';

const { Module, ObjectClass, SessionFlag } = graphene;

/** Assert the module is enabled and the library path is set. PIN is resolved
 * separately (env → DB) only when a login is actually required. */
export function assertReady() {
  if (!config.esign.enabled) throw new EsignDisabledError();
  const { libPath } = config.esign.pkcs11;
  if (!libPath) throw new Pkcs11NotConfiguredError('Missing PKCS11_LIB_PATH');
  return config.esign.pkcs11;
}

/** Pick the slot to use: configured index, else first slot with a token. */
function pickSlot(mod, slotIndex) {
  const slots = mod.getSlots(true); // token-present only
  if (slots.length === 0) throw new TokenUnavailableError();
  if (slotIndex !== undefined) {
    if (slotIndex >= slots.length) throw new TokenUnavailableError(`Slot ${slotIndex} has no token`);
    return slots.items(slotIndex);
  }
  return slots.items(0);
}

/**
 * Lightweight token probe (no login) for the health endpoint.
 * @returns {Promise<{available:boolean, tokenPresent:boolean, slots?:number, label?:string, detail?:string}>}
 */
export async function probe() {
  const { libPath } = config.esign.pkcs11;
  if (!libPath) return { available: false, tokenPresent: false, detail: 'not configured' };
  const mod = Module.load(libPath, 'esign');
  mod.initialize();
  try {
    const withToken = mod.getSlots(true);
    if (withToken.length === 0) return { available: true, tokenPresent: false, slots: 0 };
    const token = withToken.items(0).getToken();
    return {
      available: true,
      tokenPresent: true,
      slots: withToken.length,
      label: token.label.trim(),
    };
  } finally {
    mod.finalize();
  }
}

/**
 * Open a logged-in RW session and run `fn` with the loaded signing material,
 * guaranteeing logout + finalize afterwards (so a yanked token can't leak a
 * session). `login: false` skips PIN entry for read-only public-object reads.
 *
 * @template T
 * @param {(material: SigningMaterial) => Promise<T>} fn
 * @param {{login?: boolean}} [opts]
 * @returns {Promise<T>}
 */
export async function withSigningMaterial(fn, { login = true } = {}) {
  const { slot: slotIndex, certLabel } = assertReady();
  // Resolve the PIN (env → encrypted DB) only when we need to log in.
  const pin = login ? await (await import('../esign.settings.js')).resolvePin() : null;

  const mod = Module.load(config.esign.pkcs11.libPath, 'esign');
  mod.initialize();
  let session;
  try {
    const slot = pickSlot(mod, slotIndex);
    const flags = SessionFlag.SERIAL_SESSION | (login ? SessionFlag.RW_SESSION : 0);
    session = slot.open(flags);
    if (login) session.login(pin);

    const material = loadMaterial(session, { certLabel, withPrivateKey: login });
    return await fn(material);
  } finally {
    try {
      if (login) session?.logout();
      session?.close();
    } catch (e) {
      logger.warn({ err: e }, 'esign: error closing PKCS#11 session');
    }
    mod.finalize();
  }
}

/**
 * @typedef {object} SigningMaterial
 * @property {import('pkijs').Certificate} leaf
 * @property {import('pkijs').Certificate[]} chain
 * @property {string} certSerialHex
 * @property {string} certSubject
 * @property {(tbs: Buffer) => Buffer} [signRaw] present only when logged in
 */

/** Read certs (and optionally the private key) from the token. */
function loadMaterial(session, { certLabel, withPrivateKey }) {
  // Collect certificates with their CKA_ID.
  const certObjs = session.find({ class: ObjectClass.CERTIFICATE });
  const certs = [];
  for (let i = 0; i < certObjs.length; i++) {
    const obj = certObjs.items(i);
    const der = obj.getAttribute('value');
    let id = null;
    try {
      id = obj.getAttribute('id')?.toString('hex');
    } catch {
      /* some tokens omit CKA_ID on certs */
    }
    certs.push({ id, parsed: parseCertificate(der) });
  }
  if (certs.length === 0) throw new TokenUnavailableError('No certificates on token');

  // Identify the end-entity (leaf): either by configured label, by matching a
  // private-key CKA_ID, or as the cert whose subject signs nothing else.
  let leafEntry;
  let privateKey;

  if (withPrivateKey) {
    const keyObjs = session.find({ class: ObjectClass.PRIVATE_KEY });
    const keys = [];
    for (let i = 0; i < keyObjs.length; i++) {
      const k = keyObjs.items(i);
      let id = null;
      try {
        id = k.getAttribute('id')?.toString('hex');
      } catch {
        /* ignore */
      }
      keys.push({ id, key: k });
    }
    if (keys.length === 0) throw new TokenUnavailableError('No private key on token (wrong PIN?)');

    if (certLabel) {
      leafEntry = certs.find((c) => c.id === certLabel) ?? certs.find((c) => subjectCN(c.parsed) === certLabel);
    }
    if (!leafEntry) {
      // Match a cert to a private key by CKA_ID.
      const keyIds = new Set(keys.map((k) => k.id).filter(Boolean));
      leafEntry = certs.find((c) => c.id && keyIds.has(c.id)) ?? findEndEntity(certs);
    }
    privateKey =
      keys.find((k) => k.id && k.id === leafEntry.id)?.key ?? keys[0].key;
  } else {
    leafEntry = certLabel
      ? certs.find((c) => c.id === certLabel) ?? findEndEntity(certs)
      : findEndEntity(certs);
  }

  const chain = certs.filter((c) => c !== leafEntry).map((c) => c.parsed);
  const leaf = leafEntry.parsed;

  const material = {
    leaf,
    chain,
    certSerialHex: serialHex(leaf),
    certSubject: dnToString(leaf.subject),
  };

  if (withPrivateKey) {
    material.signRaw = (tbs) => {
      const sign = session.createSign('SHA256_RSA_PKCS', privateKey);
      return sign.once(Buffer.from(tbs));
    };
  }
  return material;
}

/** The cert whose subject is not the issuer of any other cert = end-entity. */
function findEndEntity(certs) {
  const issuerDers = new Set(certs.map((c) => toHex(c.parsed.issuer.toSchema().toBER(false))));
  const leaf = certs.find(
    (c) => !issuerDers.has(toHex(c.parsed.subject.toSchema().toBER(false))),
  );
  return leaf ?? certs[0];
}

/* ── small cert helpers ─────────────────────────────────────────────────── */

function toHex(ab) {
  return Buffer.from(ab).toString('hex');
}

function serialHex(cert) {
  return Buffer.from(cert.serialNumber.valueBlock.valueHexView).toString('hex');
}

function subjectCN(cert) {
  for (const rdn of cert.subject.typesAndValues) {
    if (rdn.type === '2.5.4.3') return rdn.value.valueBlock.value;
  }
  return '';
}

const DN_LABELS = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
};

function dnToString(name) {
  return name.typesAndValues
    .map((tv) => `${DN_LABELS[tv.type] ?? tv.type}=${tv.value.valueBlock.value}`)
    .join(', ');
}
