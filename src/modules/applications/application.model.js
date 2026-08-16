'use strict';

const mongoose = require('mongoose');
const { ID_TYPE, APPLICATION_STATUS } = require('../../shared/constants/enums');

/**
 * All PII fields here are encrypted+blind-indexed (or encrypted-only for idNumber/address,
 * per TAD §8's classification table) in the SERVICE layer before the model is
 * constructed/saved — never in a Mongoose hook, so the encryption dependency is explicit.
 */
const applicationSchema = new mongoose.Schema(
  {
    firstName_enc: { type: String, required: true },
    firstName_bidx: { type: String, required: true, index: true },

    lastName_enc: { type: String, required: true },
    lastName_bidx: { type: String, required: true, index: true },

    idType: { type: String, enum: Object.values(ID_TYPE), required: true },
    idNumber_enc: { type: String, required: true }, // encrypted, no search index — rarely queried

    phone_enc: { type: String, required: true },
    phone_bidx: { type: String, required: true, index: true },

    whatsapp_enc: { type: String, default: null },

    email_enc: { type: String, required: true },
    email_bidx: { type: String, required: true, index: true },

    address: {
      street_enc: { type: String, default: null },
      suburb: { type: String, default: null },
      city: { type: String, default: null },
      province: { type: String, default: null },
      postalCode: { type: String, default: null },
    },

    coursesSelected: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
      validate: { validator: (arr) => Array.isArray(arr) && arr.length > 0, message: 'At least one course must be selected' },
    },
    preferredIntake: { type: mongoose.Schema.Types.ObjectId, ref: 'Intake', required: true },

    idDocumentUrl: { type: String, required: true }, // Cloudinary private, signed delivery only
    // Cloudinary's resolved resource_type for the uploaded document ('image'
    // for JPEG/PNG/PDF, per Cloudinary's own auto-detection — never 'raw' or
    // 'video' given ALLOWED_MIME_TYPES). Required at the API layer to build a
    // private_download_url, which only accepts 'image'|'video'|'raw', not
    // 'auto'. Defaults to 'image' for documents uploaded before this field
    // existed, since every previously-accepted mime type resolves to 'image'.
    idDocumentResourceType: { type: String, default: 'image' },

    // POPIA consent capture — Frontend TAD §14 gap #1. Required before an
    // application (which includes an ID number and ID document) can be
    // persisted at all; enforced in application.validation.js and re-checked
    // in application.service.js, not just a client-side checkbox.
    consentGiven: { type: Boolean, required: true },
    consentGivenAt: { type: Date, required: true },

    referenceCode: { type: String, required: true, unique: true, index: true }, // plaintext, not PII (FR-APP-04)

    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.NEW,
    },

    totalAmount: { type: Number, required: true, min: 0 }, // server-computed only, never client-set (FR-APP-12)

    statusHistory: [
      {
        status: { type: String, enum: Object.values(APPLICATION_STATUS), required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = system (initial creation)
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ preferredIntake: 1 });
applicationSchema.index({ coursesSelected: 1 });

module.exports = mongoose.model('Application', applicationSchema);
