'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const ApiError = require('../../shared/utils/ApiError');
const authService = require('./auth.service');
const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = `/api/${env.API_VERSION}/auth`;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // mirrors JWT_REFRESH_EXPIRES_IN default (auth.service.js's REFRESH_TOKEN_TTL_MS)

/**
 * Sets the refresh token as an httpOnly cookie for browser clients (Frontend
 * TAD §5/§14). The JSON response body still includes the raw token too, for
 * non-browser API consumers (mobile apps, server-to-server) that can't rely
 * on cookie jars — the cookie is additive, not a replacement of the existing
 * response shape.
 *
 * SameSite=None is required for cross-origin deployments (frontend on
 * Netlify, backend on Render). Browsers silently drop SameSite=None cookies
 * that are not also marked Secure, so secure is hardcoded to true — Render
 * always serves over HTTPS regardless of NODE_ENV. If NODE_ENV is not set to
 * 'production' on Render, env.isProduction is false and the previous
 * secure:env.isProduction would have caused the browser to drop the cookie
 * entirely, breaking the refresh flow.
 *
 * For local HTTP development, use a tool like mkcert or set HTTPS=true, or
 * test the refresh flow via the JSON body token (non-browser path) instead.
 */
function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: REFRESH_COOKIE_PATH,
  });
}

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req.ip);
  if (!result.mfaRequired) {
    setRefreshCookie(res, result.refreshToken);
  }
  new ApiResponse(result, result.mfaRequired ? 'MFA verification required' : 'Login successful').send(res, 200);
});

const mfaVerify = asyncHandler(async (req, res) => {
  const result = await authService.verifyMfa({ userId: req.mfaUserId, code: req.body.code }, req.ip);
  setRefreshCookie(res, result.refreshToken);
  new ApiResponse(result, 'MFA verified').send(res, 200);
});

const refresh = asyncHandler(async (req, res) => {
  // Browser clients: token arrives via the httpOnly cookie (cookie-parser
  // populates req.cookies). Non-browser API consumers: token in the body,
  // per the existing API spec shape. Body takes precedence if somehow both
  // are present, purely so an explicit caller-supplied value never gets
  // silently overridden by a stale cookie.
  const refreshToken = req.body.refreshToken || req.cookies[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token is required');
  }

  const result = await authService.refresh({ refreshToken });
  new ApiResponse(result, 'Token refreshed').send(res, 200);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  clearRefreshCookie(res);
  res.status(204).send();
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  // Deliberately generic response regardless of match (API spec: 202 always)
  res.status(202).json({ success: true, data: null, message: 'If that email exists, a reset link has been sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  new ApiResponse(null, 'Password has been reset').send(res, 200);
});

module.exports = { login, mfaVerify, refresh, logout, forgotPassword, resetPassword };
