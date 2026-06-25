import { FORMATS } from '../reports.constants.js';
import { renderReportHtml } from './html.js';
import { htmlToPdf } from './pdf.js';
import { toCsv } from './csv.js';
import { toExcel } from './excel.js';

/**
 * Render a report definition's data into the requested format.
 * @returns {Promise<{buffer: Buffer, contentType: string, ext: string}>}
 */
export async function render(def, data, format) {
  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unsupported format: ${format}`);

  let buffer;
  switch (format) {
    case 'pdf':
      buffer = await htmlToPdf(renderReportHtml(def, data));
      break;
    case 'html':
      buffer = Buffer.from(renderReportHtml(def, data), 'utf8');
      break;
    case 'csv':
      buffer = toCsv(data);
      break;
    case 'xlsx':
      buffer = await toExcel(data);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  return { buffer, contentType: fmt.contentType, ext: fmt.ext };
}

export { closePdfRenderer } from './pdf.js';
