'use strict';

const env = require('./env');

/**
 * Envelope-encryption key access, abstracted behind a provider interface so the
 * interim approach (secrets manager) can be swapped for a real KMS (AWS KMS / GCP KMS /
 * Azure Key Vault) later WITHOUT touching any call site in encryption.js or blindIndex.js.
 *
 * Interim decision (per client sign-off): 'secrets-manager' provider. In this mode we still
 * never persist the plaintext key material in application code or logs — it is resolved once
 * at boot from the secrets manager (represented here by env vars pointing at key REFERENCES,
 * not raw values, except in the local-dev fallback which is explicitly blocked in production
 * by env.js).
 *
 * Contract every provider must satisfy:
 *   getDataEncryptionKey()  -> Promise<Buffer>  (32 bytes, for AES-256-GCM)
 *   getBlindIndexKey()      -> Promise<Buffer>  (32 bytes, for HMAC-SHA-256)
 */

let cachedDEK = null;
let cachedBlindIndexKey = null;

async function secretsManagerProvider() {
  // NOTE: this is the interim stand-in for a real secrets-manager SDK call
  // (e.g. Vault, Doppler, AWS Secrets Manager). Swap the body of these two
  // resolvers for actual SDK calls when the client provisions one — the
  // rest of the codebase never needs to change.
  if (!env.DEV_MASTER_KEY_HEX || !env.DEV_BLIND_INDEX_KEY_HEX) {
    throw new Error(
      '[kms] No key material resolvable. Set DEV_MASTER_KEY_HEX / DEV_BLIND_INDEX_KEY_HEX for local dev, ' +
        'or wire a real secrets-manager SDK call into src/config/kms.js before deploying.'
    );
  }
  return {
    dek: Buffer.from(env.DEV_MASTER_KEY_HEX, 'hex'),
    blindIndexKey: Buffer.from(env.DEV_BLIND_INDEX_KEY_HEX, 'hex'),
  };
}

async function resolveKeys() {
  switch (env.KMS_PROVIDER) {
    case 'secrets-manager':
      return secretsManagerProvider();
    // case 'aws-kms': return awsKmsProvider();
    // case 'gcp-kms': return gcpKmsProvider();
    default:
      throw new Error(`[kms] Unknown KMS_PROVIDER: ${env.KMS_PROVIDER}`);
  }
}

async function getDataEncryptionKey() {
  if (!cachedDEK) {
    const { dek } = await resolveKeys();
    if (dek.length !== 32) {
      throw new Error('[kms] Data encryption key must be 32 bytes for AES-256-GCM');
    }
    cachedDEK = dek;
  }
  return cachedDEK;
}

async function getBlindIndexKey() {
  if (!cachedBlindIndexKey) {
    const { blindIndexKey } = await resolveKeys();
    if (blindIndexKey.length !== 32) {
      throw new Error('[kms] Blind index key must be 32 bytes for HMAC-SHA-256');
    }
    cachedBlindIndexKey = blindIndexKey;
  }
  return cachedBlindIndexKey;
}

// Test-only: allow resetting the cache between test suites that swap env vars.
function _resetCacheForTests() {
  cachedDEK = null;
  cachedBlindIndexKey = null;
}

module.exports = { getDataEncryptionKey, getBlindIndexKey, _resetCacheForTests };
