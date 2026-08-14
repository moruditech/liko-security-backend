'use strict';

const crypto = require('crypto');
const keyProvider = require('./keyProvider');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string with AES-256-GCM (authenticated encryption —
 * tampering with ciphertext is detectable on decrypt, not just confidentiality).
 *
 * Storage format: base64(iv) + '.' + base64(authTag) + '.' + base64(ciphertext)
 * Stored as a single string in the *_enc field so Mongoose schemas stay simple.
 *
 * @param {string} plaintext
 * @returns {Promise<string|null>} null passes through untouched (optional fields)
 */
async function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt() expects a string');
  }

  const key = await keyProvider.getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.');
}

/**
 * Decrypts a string produced by encrypt(). Throws if the auth tag doesn't match
 * (tampering / wrong key) — callers should treat decrypt failures as integrity
 * failures, not silently swallow them.
 *
 * @param {string|null} stored
 * @returns {Promise<string|null>}
 */
async function decrypt(stored) {
  if (stored === null || stored === undefined || stored === '') {
    return null;
  }

  const parts = stored.split('.');
  if (parts.length !== 3) {
    throw new Error('[encryption] Malformed ciphertext payload');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;

  const key = await keyProvider.getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Convenience for encrypting an object's fields in bulk, e.g. an address sub-object.
 * Only encrypts keys present in `fields`; leaves everything else untouched.
 */
async function encryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field] = await encrypt(obj[field]);
    }
  }
  return result;
}

async function decryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field] = await decrypt(obj[field]);
    }
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptFields, decryptFields };
