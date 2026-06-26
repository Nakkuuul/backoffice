import { config } from '../../../config/index.js';

/**
 * Minimal, dependency-free template registry. Each template is a function
 * returning { subject, html, text }. Inline CSS + a plain-text alternative are
 * used deliberately: multipart text/html and simple, table-free markup improve
 * inbox placement and render consistently across mail clients.
 *
 * Keep templates small and transactional in tone; marketing-style content hurts
 * deliverability for operational mail.
 */

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout({ title, bodyHtml }) {
  const brand = esc(config.email.fromName);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:8px;padding:28px;border:1px solid #e5e7eb;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0b3d91;">${brand}</h2>
      ${bodyHtml}
    </div>
    <p style="font-size:11px;color:#8a8a8a;text-align:center;margin:16px 0 0;">
      This is an automated message from ${brand}. Please do not reply.
    </p>
  </div>
</body></html>`;
}

const templates = {
  /** Generic transactional wrapper around a plain message body. */
  generic: (data) => {
    const subject = data.subject || config.email.fromName;
    const paras = String(data.message || '')
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
    return {
      subject,
      html: layout({ title: subject, bodyHtml: paras }),
      text: String(data.message || ''),
    };
  },

  /** Password-reset link (the "forgot access" email-link channel). */
  'password-reset-link': (data) => {
    const name = esc(data.name || 'there');
    const url = String(data.resetUrl || '');
    const mins = esc(data.ttlMinutes || 30);
    const subject = data.subject || `${config.email.fromName}: reset your password`;
    const bodyHtml = `
      <p>Hi ${name},</p>
      <p>We received a request to reset your ${esc(config.email.fromName)} password.
         Click the button below to choose a new one. This link expires in ${mins} minutes
         and can be used once.</p>
      <p style="margin:24px 0;">
        <a href="${esc(url)}" style="background:#6E1F2A;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;">Reset password</a>
      </p>
      <p style="font-size:12px;color:#666;">Or paste this link into your browser:<br>${esc(url)}</p>
      <p style="margin-top:20px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`;
    const text = [
      `Hi ${data.name || 'there'},`,
      '',
      `Reset your ${config.email.fromName} password (link expires in ${mins} minutes, single use):`,
      url,
      '',
      `If you didn't request this, ignore this email — your password won't change.`,
    ].join('\n');
    return { subject, html: layout({ title: subject, bodyHtml }), text };
  },

  /** Password-reset one-time code (the OTP channel — email or as SMS text). */
  'password-reset-otp': (data) => {
    const name = esc(data.name || 'there');
    const code = esc(data.code || '');
    const mins = esc(data.ttlMinutes || 10);
    const subject = data.subject || `${config.email.fromName}: your password reset code`;
    const bodyHtml = `
      <p>Hi ${name},</p>
      <p>Use this one-time code to reset your ${esc(config.email.fromName)} password.
         It expires in ${mins} minutes.</p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:20px 0;color:#0b3d91;">${code}</p>
      <p style="margin-top:20px;">If you didn't request this, you can safely ignore this email.</p>`;
    const text = `Your ${config.email.fromName} password reset code is ${code} (expires in ${mins} minutes). If you didn't request this, ignore this email.`;
    return { subject, html: layout({ title: subject, bodyHtml }), text };
  },

  /** Sent when an esigned document is delivered to a client. */
  'signed-document': (data) => {
    const name = esc(data.clientName || 'Customer');
    const docTitle = esc(data.documentTitle || 'your document');
    const subject = data.subject || `${config.email.fromName}: ${data.documentTitle || 'Signed document'}`;
    const bodyHtml = `
      <p>Dear ${name},</p>
      <p>Please find attached <strong>${docTitle}</strong>, digitally signed with our
         Digital Signature Certificate.</p>
      ${data.message ? `<p>${esc(data.message)}</p>` : ''}
      <p>The signature can be verified in any standard PDF reader.</p>
      <p style="margin-top:24px;">Regards,<br>${esc(config.email.fromName)}</p>`;
    const text = [
      `Dear ${data.clientName || 'Customer'},`,
      '',
      `Please find attached ${data.documentTitle || 'your document'}, digitally signed with our Digital Signature Certificate.`,
      data.message ? `\n${data.message}\n` : '',
      'The signature can be verified in any standard PDF reader.',
      '',
      `Regards,`,
      config.email.fromName,
    ].join('\n');
    return { subject, html: layout({ title: subject, bodyHtml }), text };
  },
};

/**
 * Render a named template.
 * @returns {{subject:string, html:string, text:string}}
 */
export function render(templateName, data = {}) {
  const fn = templates[templateName];
  if (!fn) throw new Error(`Unknown email template: ${templateName}`);
  return fn(data);
}

export function hasTemplate(name) {
  return Boolean(templates[name]);
}
