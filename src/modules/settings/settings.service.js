'use strict';

const Settings = require('./settings.model');
const { logAudit } = require('../auditLogs/auditLog.service');

/**
 * Ensures the singleton doc exists and returns it. Called by any module that
 * needs settings (Applications for fee calc; the public /settings endpoint
 * and admin PATCH route in Phase 4).
 */
async function getSettings() {
  let settings = await Settings.findById(Settings.SINGLETON_ID);
  if (!settings) {
    settings = await Settings.create({ _id: Settings.SINGLETON_ID });
  }
  return settings;
}

async function getPsiraRegistrationFee() {
  const settings = await getSettings();
  return settings.psiraRegistrationFee;
}

/**
 * Public-safe projection (API spec B.8: GET /settings, no auth). Includes
 * bankAccounts deliberately — the scope doc's Page 5 (Student Registration /
 * Apply Now) explicitly requires banking details to be shown publicly for
 * applicants making EFT payments, and they're also embedded in the pro-forma
 * invoice PDF sent pre-authentication. Nothing else on the singleton doc is
 * exposed.
 */
async function getPublicSettings() {
  const settings = await getSettings();
  return {
    bankAccounts: settings.bankAccounts,
    psiraRegistrationFee: settings.psiraRegistrationFee,
    whatsappNumber: settings.whatsappNumber,
    contactPhone: settings.contactPhone,
  };
}

async function updateSettings(updates, actorId) {
  const settings = await getSettings();
  Object.assign(settings, updates);
  await settings.save();

  await logAudit({ actor: actorId, action: 'settings.updated', targetType: 'Settings', targetId: settings._id, metadata: { fields: Object.keys(updates) } });
  return settings;
}

module.exports = { getSettings, getPsiraRegistrationFee, getPublicSettings, updateSettings };
