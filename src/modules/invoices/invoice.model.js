'use strict';

const mongoose = require('mongoose');
const { INVOICE_TYPE } = require('../../shared/constants/enums');

const invoiceSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    type: { type: String, enum: Object.values(INVOICE_TYPE), required: true },
    referenceCode: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    pdfUrl: { type: String, required: true }, // Cloudinary public_id — durable, re-sendable without regenerating (FR-INV-04)
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Idempotency support (FR-APP-09): at most one official invoice per application.
invoiceSchema.index({ application: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
