'use strict';

const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../../modules/auth/auth.utils');
const User = require('../../modules/users/user.model');

/**
 * Verifies the Bearer JWT access token, loads the user (must still exist and
 * be active), and attaches a minimal req.user context used by permission.middleware.js
 * and ownership.middleware.js downstream. Applied route-specific per TAD §5 row 8,
 * not globally in app.js (public routes must stay unauthenticated).
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed authorization header');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }

  if (decoded.mfaPending) {
    // Token issued mid-MFA-challenge must never be usable as a full session token.
    throw ApiError.unauthorized('MFA verification required');
  }

  const user = await User.findById(decoded.sub).populate('role');
  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }
  if (!user.isActive) {
    // FR-USR-01: deactivated users cannot log in / act, even with a still-valid token
    throw ApiError.unauthorized('Account is deactivated');
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    roleId: user.role._id.toString(),
    roleName: user.role.name,
    permissions: user.role.permissions,
  };

  next();
});

module.exports = { authenticate };
