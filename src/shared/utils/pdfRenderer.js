'use strict';

const path = require('path');
const ejs = require('ejs');
const htmlPdf = require('html-pdf-node');

const TEMPLATES_DIR = path.join(__dirname, '../../templates/pdf');

const PDF_OPTIONS = {
  format: 'A4',
  printBackground: true,
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
};

/**
 * Renders an EJS template (from src/templates/pdf/) with the given data into
 * a PDF buffer using html-pdf-node.
 *
 * @param {string} templateName - filename without extension, e.g. 'proforma-invoice'
 * @param {object} data - template variables passed to EJS
 * @returns {Promise<Buffer>}
 */
async function renderPdfFromTemplate(templateName, data) {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
  const html = await ejs.renderFile(templatePath, data);
  const file = { content: html };
  return htmlPdf.generatePdf(file, PDF_OPTIONS);
}

module.exports = { renderPdf: renderPdfFromTemplate };
