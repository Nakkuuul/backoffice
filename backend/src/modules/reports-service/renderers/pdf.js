import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * HTML → PDF via headless Chromium (Puppeteer). A single browser instance is
 * launched lazily and reused across reports (launching per-report is far too
 * slow for bulk runs). Pages are created/closed per render.
 */
let browserPromise;

async function getBrowser() {
  if (!browserPromise) {
    const { default: puppeteer } = await import('puppeteer');
    browserPromise = puppeteer.launch({
      headless: true,
      args: config.reports.puppeteerArgs,
    });
    logger.info('reports: launched Chromium for PDF rendering');
  }
  return browserPromise;
}

/** @returns {Promise<Buffer>} */
export async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(
      await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      }),
    );
  } finally {
    await page.close();
  }
}

/** Close the shared browser on shutdown. */
export async function closePdfRenderer() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch (err) {
      logger.warn({ err }, 'reports: error closing Chromium');
    }
    browserPromise = undefined;
  }
}
