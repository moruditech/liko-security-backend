'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/liko_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.KMS_PROVIDER = 'secrets-manager';
// 32-byte (64 hex char) test-only keys — never used outside the test environment.
process.env.DEV_MASTER_KEY_HEX =
  process.env.DEV_MASTER_KEY_HEX || 'a'.repeat(64);
process.env.DEV_BLIND_INDEX_KEY_HEX =
  process.env.DEV_BLIND_INDEX_KEY_HEX || 'b'.repeat(64);
