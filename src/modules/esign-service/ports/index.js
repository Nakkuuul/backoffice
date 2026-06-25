import { AppError } from '../../../shared/errors/AppError.js';

/**
 * Ports = the contracts eSign needs from OTHER modules that don't exist yet
 * (document source, email delivery). eSign depends on these interfaces, not on
 * those modules directly — so it compiles and runs today, and the real modules
 * "plug in" later via registerDocumentSource() / registerEmailSender().
 *
 * This is a dependency-inversion seam: when you build the document module, call
 * registerDocumentSource(impl) during its bootstrap; same for email/SMTP.
 */

class NotRegisteredError extends AppError {
  constructor(port, module) {
    super(`${port} is not available yet — the ${module} module is not wired`, 501, {
      code: 'PORT_NOT_REGISTERED',
    });
  }
}

/**
 * DocumentSource contract — supplied by the future `documents` module.
 * @typedef {object} DocumentSource
 * @property {(ref: string) => Promise<{buffer: Buffer, name: string, contentType: string}>} getDocument
 */

/**
 * EmailSender contract — supplied by the future `email`/SMTP module.
 * @typedef {object} EmailSender
 * @property {(msg: {to: string[], subject: string, body?: string,
 *   attachments: Array<{filename: string, content: Buffer, contentType: string}>}) => Promise<{messageId: string}>} sendMail
 */

const defaultDocumentSource = {
  async getDocument() {
    throw new NotRegisteredError('DocumentSource', 'documents');
  },
};

const defaultEmailSender = {
  async sendMail() {
    throw new NotRegisteredError('EmailSender', 'email');
  },
};

let documentSource = defaultDocumentSource;
let emailSender = defaultEmailSender;

/** @param {DocumentSource} impl */
export function registerDocumentSource(impl) {
  documentSource = impl;
}
/** @returns {DocumentSource} */
export function getDocumentSource() {
  return documentSource;
}

/** @param {EmailSender} impl */
export function registerEmailSender(impl) {
  emailSender = impl;
}
/** @returns {EmailSender} */
export function getEmailSender() {
  return emailSender;
}
