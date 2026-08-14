'use strict';

require('dotenv').config();

/**
 * Centralized environment access. Every other module reads config from here,
 * never from process.env directly — keeps validation and defaults in one place.
 */

const REQUIRED_IN_ALL_ENVS = [
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const REQUIRED_IN_PRODUCTION = [
  'KMS_PROVIDER',
  'KMS_KEY_ID',
  'BLIND_INDEX_KEY_REF',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'MAILJET_API_KEY',
  'MAILJET_API_SECRET',
  'FRONTEND_URL',
];

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k] || process.env[k].trim() === '');
  if (missing.length > 0) {
    // Fail fast and loud — a missing secret should never surface later as a cryptic runtime error.
    // eslint-disable-next-line no-console
    console.error(`[env] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const NODE_ENV = process.env.NODE_ENV || 'development';

requireEnv(REQUIRED_IN_ALL_ENVS);
if (NODE_ENV === 'production') {
  requireEnv(REQUIRED_IN_PRODUCTION);
  if (process.env.KMS_PROVIDER === 'secrets-manager' || process.env.DEV_MASTER_KEY_HEX) {
    // The interim secrets-manager approach is acceptable pre-production, but production
    // must not boot on the local-dev-key fallback path in kms.js.
    // eslint-disable-next-line no-console
    console.error('[env] Refusing to boot in production with a dev-fallback key provider. Configure a real KMS_PROVIDER.');
    process.exit(1);
  }
}

module.exports = {
  NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_VERSION: process.env.API_VERSION || 'v1',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  MONGO_URI: process.env.MONGO_URI,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  KMS_PROVIDER: process.env.KMS_PROVIDER || 'secrets-manager',
  KMS_KEY_ID: process.env.KMS_KEY_ID,
  BLIND_INDEX_KEY_REF: process.env.BLIND_INDEX_KEY_REF,
  DEV_MASTER_KEY_HEX: process.env.DEV_MASTER_KEY_HEX,
  DEV_BLIND_INDEX_KEY_HEX: process.env.DEV_BLIND_INDEX_KEY_HEX,

  MFA_ISSUER: process.env.MFA_ISSUER || 'Liko Security Training',
  ENFORCE_MFA_FOR_SUPER_ADMIN: process.env.ENFORCE_MFA_FOR_SUPER_ADMIN === 'true',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_PRIVATE_FOLDER: process.env.CLOUDINARY_PRIVATE_FOLDER || 'liko/id-documents',
  CLOUDINARY_PUBLIC_FOLDER: process.env.CLOUDINARY_PUBLIC_FOLDER || 'liko/public',

  MAILJET_API_KEY: process.env.MAILJET_API_KEY,
  MAILJET_API_SECRET: process.env.MAILJET_API_SECRET,
  MAILJET_SENDER_EMAIL: process.env.MAILJET_SENDER_EMAIL,
  MAILJET_SENDER_NAME: process.env.MAILJET_SENDER_NAME || 'Liko Security Training',

  RATE_LIMIT_GLOBAL_WINDOW_MS: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || '900000', 10),
  RATE_LIMIT_GLOBAL_MAX: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '300', 10),
  RATE_LIMIT_STRICT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_STRICT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_STRICT_MAX: parseInt(process.env.RATE_LIMIT_STRICT_MAX || '5', 10),

  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '1mb',
};
