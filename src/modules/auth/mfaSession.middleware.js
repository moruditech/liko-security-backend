'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiError = require('../../shared/utils/ApiError');
const { verifyAccessToken } = require('./auth.utils');

/**
 * Verifies the short-lived "partial session" token issued by POST /auth/login
 * when MFA is required. Distinct from shared/middleware/auth.middleware.js,
 * which explicitly REJECTS mfaPending tokens — this is the one place they're
 * accepted, and only to complete the MFA challenge.
 */
const requireMfaPendingSession = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing MFA session token');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired MFA session token');
  }

  if (!decoded.mfaPending) {
    throw ApiError.unauthorized('Not an MFA-pending session');
  }

  req.mfaUserId = decoded.sub;
  next();
});

module.exports = { requireMfaPendingSession };
