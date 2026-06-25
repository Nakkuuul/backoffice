import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';

const BOX_W = 230;
const BOX_H = 74;
const MARGIN = 36;

/** Compute the [x1,y1,x2,y2] widget rect for the chosen page corner. */
function rectForCorner(corner, pageWidth, pageHeight) {
  const right = pageWidth - MARGIN;
  const left = MARGIN;
  const top = pageHeight - MARGIN;
  const bottom = MARGIN;
  switch (corner) {
    case 'bottom-left':
      return [left, bottom, left + BOX_W, bottom + BOX_H];
    case 'top-right':
      return [right - BOX_W, top - BOX_H, right, top];
    case 'top-left':
      return [left, top - BOX_H, left + BOX_W, top];
    case 'bottom-right':
    default:
      return [right - BOX_W, bottom, right, bottom + BOX_H];
  }
}

/** Truncate text to fit within `maxWidth` at the given font/size. */
function fit(text, font, size, maxWidth) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

/**
 * Add a VISIBLE PAdES signature placeholder to a PDF.
 *
 * Draws a bordered stamp (signer, date, reason) onto the chosen page and places
 * the signature widget over it, then inserts the byte-range/Contents
 * placeholder. Loading via pdf-lib also normalizes xref-stream PDFs, so this
 * path handles modern PDFs without a separate normalization step.
 *
 * @returns {Promise<Buffer>} PDF bytes containing the placeholder
 */
export async function addVisibleSignaturePlaceholder(
  pdfBuffer,
  { name, reason, location, contactInfo, signingTime, signatureLength, page = 'first', corner },
) {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = doc.getPages();
  const target = page === 'last' ? pages[pages.length - 1] : pages[0];
  const { width, height } = target.getSize();
  const rect = rectForCorner(corner, width, height);
  const [x1, y1, x2, y2] = rect;

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pad = 6;
  const innerW = x2 - x1 - pad * 2;

  // Border + faint fill so the stamp reads as a signature block.
  target.drawRectangle({
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    borderColor: rgb(0.1, 0.3, 0.6),
    borderWidth: 1,
    color: rgb(0.96, 0.97, 1),
    opacity: 1,
  });

  const when = (signingTime ?? new Date()).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const lines = [
    { text: 'Digitally signed by', size: 7, font, color: rgb(0.25, 0.25, 0.25) },
    { text: fit(name || 'DSC holder', bold, 9, innerW), size: 9, font: bold, color: rgb(0, 0, 0) },
    { text: fit(`Date: ${when}`, font, 7, innerW), size: 7, font, color: rgb(0.2, 0.2, 0.2) },
  ];
  if (reason) {
    lines.push({ text: fit(`Reason: ${reason}`, font, 7, innerW), size: 7, font, color: rgb(0.2, 0.2, 0.2) });
  }
  if (location) {
    lines.push({ text: fit(`Location: ${location}`, font, 7, innerW), size: 7, font, color: rgb(0.2, 0.2, 0.2) });
  }

  let cursorY = y2 - pad - 8;
  for (const line of lines) {
    target.drawText(line.text, { x: x1 + pad, y: cursorY, size: line.size, font: line.font, color: line.color });
    cursorY -= line.size + 3;
  }

  pdflibAddPlaceholder({
    pdfDoc: doc,
    pdfPage: target,
    reason: reason || '',
    location: location || '',
    contactInfo: contactInfo || '',
    name: name || '',
    signingTime,
    signatureLength,
    widgetRect: rect,
  });

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
