'use strict';

const path = require('path');
const ejs = require('ejs');
const { renderPdf } = require('vellora');

const TEMPLATES_DIR = path.join(__dirname, '../../templates/pdf');

/**
 * Injects an @page rule into the rendered HTML so Vellora uses A4 with the
 * same margins that were previously passed to Puppeteer's page.pdf(). The
 * injection targets the closing </style> tag that every PDF template has, so
 * template files themselves do not need to be modified.
 */
function injectPageRule(html) {
  const pageRule = '@page { size: A4; margin: 20mm 15mm; }\n';
  return html.includes('</style>')
    ? html.replace('</style>', pageRule + '</style>')
    : html;
}

/**
 * Renders an EJS template (from src/templates/pdf/) with the given data into
 * a PDF buffer using Vellora — a native Node.js HTML-to-PDF renderer that
 * requires no browser, no Chrome binary, and no postinstall step. Works on
 * any environment including Render's free tier.
 *
 * @param {string} templateName - filename without extension, e.g. 'proforma-invoice'
 * @param {object} data - template variables passed to EJS
 * @returns {Promise<Buffer>}
 */
async function renderPdfFromTemplate(templateName, data) {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
  const html = await ejs.renderFile(templatePath, data);
  const htmlWithPage = injectPageRule(html);
  return renderPdf(htmlWithPage);
}

module.exports = { renderPdf: renderPdfFromTemplate };
