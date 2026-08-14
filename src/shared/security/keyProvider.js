'use strict';

const kms = require('../../config/kms');

/**
 * Thin indirection layer between the crypto primitives (encryption.js, blindIndex.js)
 * and the actual key source (config/kms.js). Exists so encryption.js never imports
 * config/kms.js directly — if key *retrieval* strategy changes (e.g. per-tenant keys,
 * key rotation with key versioning) later, only this file changes.
 */

async function getEncryptionKey() {
  return kms.getDataEncryptionKey();
}

async function getBlindIndexKey() {
  return kms.getBlindIndexKey();
}

module.exports = { getEncryptionKey, getBlindIndexKey };
