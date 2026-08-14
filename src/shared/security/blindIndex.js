'use strict';

const crypto = require('crypto');
const keyProvider = require('./keyProvider');

/**
 * Deterministic HMAC-SHA-256 blind index for searchable encrypted fields
 * (name, email, phone, whatsapp — per TAD §8 classification table).
 *
 * Deterministic + one-way + indexable, but NOT reversible to the original value.
 * Search queries hash the input the same way and match against the index;
 * matched documents are then decrypted (via encryption.js) for display.
 *
 * IMPORTANT normalization: the same logical value must always hash to the same
 * index regardless of casing/whitespace, or searches silently miss matches.
 * Normalization is intentionally simple (trim + lowercase) and MUST be applied
 * identically at write time and at query time — never normalize differently
 * in one path.
 *
 * Known trade-off (documented in TAD §8): deterministic indexing on low-cardinality
 * values is theoretically vulnerable to frequency analysis with direct DB access.
 * Mitigated by least-privilege DB roles + network restriction (TAD §11), not by
 * avoiding the pattern — full random encryption would make fields unsearchable.
 *
 * @param {string} value - raw plaintext value to index
 * @returns {Promise<string|null>} hex-encoded HMAC, or null for empty/missing input
 */
async function computeBlindIndex(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError('computeBlindIndex() expects a string');
  }

  const normalized = normalize(value);
  const key = await keyProvider.getBlindIndexKey();
  return crypto.createHmac('sha256', key).update(normalized, 'utf8').digest('hex');
}

function normalize(value) {
  return value.trim().toLowerCase();
}

module.exports = { computeBlindIndex, normalize };
