'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const ApiError = require('../utils/ApiError');

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(ApiError.tooManyRequests(message || 'Too many requests, please try again later.'));
    },
  });
}

// Baseline abuse protection on all routes (TAD §5, row 3)
const globalLimiter = buildLimiter({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: env.RATE_LIMIT_GLOBAL_MAX,
});

// Tighter limits for /auth/login, /auth/forgot-password, /applications (TAD §5 row 7, FR-AUTH-02)
// FR-AUTH-02 specifies max 5 attempts per account+IP per 15 minutes; express-rate-limit's default
// keyGenerator is IP-based. We key on IP + normalized email/body identifier where applicable via
// a custom keyGenerator so it's account+IP scoped, not IP-only.
function accountAwareKeyGenerator(req) {
  const identifier = (req.body && (req.body.email || req.body.applicantEmail)) || '';
  return `${req.ip}:${String(identifier).trim().toLowerCase()}`;
}

const strictLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_STRICT_WINDOW_MS,
  max: env.RATE_LIMIT_STRICT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: accountAwareKeyGenerator,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('Too many attempts. Please try again later.'));
  },
});

// Public application/inquiry submission — spam prevention, not account-scoped (no account yet)
const publicSubmissionLimiter = buildLimiter({
  windowMs: env.RATE_LIMIT_STRICT_WINDOW_MS,
  max: 10,
  message: 'Too many submissions from this address. Please try again later.',
});

module.exports = { globalLimiter, strictLimiter, publicSubmissionLimiter };
