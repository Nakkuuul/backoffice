import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';
import { Pkcs11DependencyMissingError, TokenUnavailableError } from './errors.js';
import { SignerProvider } from './SignerProvider.js';

// Re-export error types so callers/tests can import from one place.
export * from './errors.js';

/**
 * Signs PDFs (PAdES, adbe.pkcs7.detached) using a physical DSC token over
 * PKCS#11. All heavy/native work lives in token.js (device) and cms.js
 * (signature structure), loaded lazily so the app boots without the toolchain.
 */
export class Pkcs11PdfSigner extends SignerProvider {
  isEnabled() {
    return Boolean(config.esign.enabled);
  }

  /** Lazily import native/heavy deps, mapping a missing module to a clear error. */
  async #load() {
    try {
      const [{ withSigningMaterial, probe }, { buildCmsSignature }, signpdf, placeholder] =
        await Promise.all([
          import('./token.js'),
          import('./cms.js'),
          import('@signpdf/signpdf'),
          import('@signpdf/placeholder-plain'),
        ]);
      return {
        withSigningMaterial,
        probe,
        buildCmsSignature,
        SignPdf: signpdf.SignPdf,
        plainAddPlaceholder: placeholder.plainAddPlaceholder,
      };
    } catch (err) {
      if (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.code === 'MODULE_NOT_FOUND') {
        const pkg = /'([^']+)'/.exec(err.message)?.[1] ?? 'a native dependency';
        throw new Pkcs11DependencyMissingError(pkg);
      }
      throw err;
    }
  }

  async getStatus() {
    if (!this.isEnabled()) return { available: false, tokenPresent: false, detail: 'disabled' };
    try {
      const { probe } = await this.#load();
      return await probe();
    } catch (err) {
      logger.warn({ err }, 'esign: token probe failed');
      return { available: false, tokenPresent: false, detail: err.message };
    }
  }

  async getCertificate() {
    const { withSigningMaterial } = await this.#load();
    // Read public cert objects without a PIN.
    return withSigningMaterial(
      async (m) => ({
        subject: m.certSubject,
        serial: m.certSerialHex,
        issuer: dnString(m.leaf.issuer),
        validFrom: m.leaf.notBefore.value.toISOString(),
        validTo: m.leaf.notAfter.value.toISOString(),
        chainLength: m.chain.length,
      }),
      { login: false },
    );
  }

  /**
   * Apply a PAdES signature. Adds a placeholder, then signs the ByteRange via
   * a CMS built around the token's RSA operation.
   */
  async signPdf(pdfBuffer, options = {}) {
    const { withSigningMaterial, buildCmsSignature, SignPdf } = await this.#load();
    const { Signer } = await import('@signpdf/utils');
    const appearance = { ...config.esign.appearance, ...options };
    const signatureLength = 16384; // room for leaf + CA chain + signature
    const signingTime = new Date();

    return withSigningMaterial(async (material) => {
      if (!material.signRaw) throw new TokenUnavailableError('No signing key available');

      // Build the placeholder. Visible stamp uses the signer's CN from the cert.
      const withPlaceholder = await this.#addPlaceholder(pdfBuffer, {
        ...appearance,
        name: appearance.name || material.certCN,
        signingTime,
        signatureLength,
      });

      // Bridge our CMS builder into @signpdf's Signer contract.
      const tokenSigner = new (class extends Signer {
        async sign(content, time = signingTime) {
          return buildCmsSignature(content, {
            leaf: material.leaf,
            chain: material.chain,
            signingTime: time,
            signRaw: material.signRaw,
          });
        }
      })();

      const signed = await new SignPdf().sign(withPlaceholder, tokenSigner);
      return {
        signed,
        certSerial: material.certSerialHex,
        certSubject: material.certSubject,
        algorithm: 'sha256WithRSAEncryption',
      };
    });
  }

  /**
   * Produce a PDF with a signature placeholder — visible stamp by default,
   * falling back to an invisible placeholder if appearance.visible is false or
   * the visible path fails for a given document.
   */
  async #addPlaceholder(pdfBuffer, opts) {
    if (opts.visible !== false) {
      try {
        const { addVisibleSignaturePlaceholder } = await import('./appearance.js');
        return await addVisibleSignaturePlaceholder(pdfBuffer, opts);
      } catch (err) {
        logger.warn({ err: err.message }, 'esign: visible appearance failed, using invisible');
      }
    }
    // Invisible fallback.
    const { plainAddPlaceholder } = await import('@signpdf/placeholder-plain');
    const base = { ...opts };
    try {
      return plainAddPlaceholder({ pdfBuffer, ...base });
    } catch {
      const normalized = await normalizePdf(pdfBuffer);
      return plainAddPlaceholder({ pdfBuffer: normalized, ...base });
    }
  }
}

/** Rewrite a PDF with a classic xref table so @signpdf can place a signature. */
async function normalizePdf(pdfBuffer) {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

/* DN → string for issuer display (mirrors token.js helper). */
const DN_LABELS = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
};
function dnString(name) {
  return name.typesAndValues
    .map((tv) => `${DN_LABELS[tv.type] ?? tv.type}=${tv.value.valueBlock.value}`)
    .join(', ');
}
