import { SmtpTransport } from './SmtpTransport.js';

/**
 * One shared transport per process. Swap the implementation here to introduce
 * a provider-HTTP-API transport or a multi-relay round-robin later.
 */
let instance;

export function getTransport() {
  if (!instance) instance = new SmtpTransport();
  return instance;
}

export function closeTransport() {
  instance?.close();
  instance = undefined;
}
