'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const env = require('../../config/env');

const BCRYPT_COST_FACTOR = 12; // NFR-SEC-03: cost factor >= 12

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_COST_FACTOR);
}

async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

function signAccessToken(payload) {
  // payload: { sub: userId, role: roleId, permissions: [...], mfaPending: bool }
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

/**
 * Refresh tokens are stored server-side as a hash (never the raw token) so a DB
 * read alone can't be replayed as a valid session (FR-AUTH-05: revocable server-side).
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
};
