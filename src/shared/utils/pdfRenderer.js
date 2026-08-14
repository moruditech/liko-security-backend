'use strict';

const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

const TEMPLATES_DIR = path.join(__dirname, '../../templates/pdf');

let browserPromise = null;

/**
 * Puppeteer's browser instance is expensive to launch — reused across requests
 * rather than launched fresh per PDF. Lazily started on first use.
 */
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // required in most containerized deploy targets
    });
  }
  return browserPromise;
}

/**
 * Renders an EJS template (from src/templates/pdf/) with the given data into
 * a PDF buffer.
 *
 * @param {string} templateName - filename without extension, e.g. 'proforma-invoice'
 * @param {object} data - template variables
 * @returns {Promise<Buffer>}
 */
async function renderPdf(templateName, data) {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
  const html = await ejs.renderFile(templatePath, data);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

module.exports = { renderPdf, closeBrowser };
