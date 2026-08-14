'use strict';

const mongoose = require('mongoose');

/**
 * Singleton document — enforced by always querying/upserting a fixed _id.
 * Full CRUD/admin routes land in Phase 4; this model + a couple of read
 * helpers are pulled forward here because Applications (Phase 2) has a real
 * dependency on psiraRegistrationFee for totalAmount computation (FR-APP-*,
 * scope doc's fee calculator).
 */
const SINGLETON_ID = 'liko-settings-singleton';

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: SINGLETON_ID },
    bankAccounts: [
      {
        bankName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        branchCode: { type: String, required: true },
      },
    ],
    psiraRegistrationFee: { type: Number, required: true, default: 500 }, // R500 per scope doc
    whatsappNumber: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
  },
  { timestamps: true }
);

settingsSchema.statics.SINGLETON_ID = SINGLETON_ID;

module.exports = mongoose.model('Settings', settingsSchema);
