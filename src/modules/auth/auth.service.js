'use strict';

const speakeasy = require('speakeasy');
const User = require('../users/user.model');
const encryption = require('../../shared/security/encryption');
const blindIndex = require('../../shared/security/blindIndex');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');
const { sendEmail } = require('../../shared/utils/mailer');
const env = require('../../config/env');
const {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
} = require('./auth.utils');

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // mirrors JWT_REFRESH_EXPIRES_IN default
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MFA_PENDING_TOKEN_TTL = '5m';

/**
 * FR-AUTH-01: generic "invalid credentials" on any failure — never reveals
 * whether the email exists. Every failure path below throws the identical error.
 */
const INVALID_CREDENTIALS = () => ApiError.unauthorized('Invalid email or password');

/**
 * Shapes the `user` object sent to the frontend after login/MFA/refresh.
 * Must stay in sync with the frontend's AuthUser type (types/api.ts): id,
 * name, email, role (name string), permissions (string[]). The frontend's
 * PermissionGate reads `permissions` straight off this object with no
 * fallback, so any field missing here throws client-side
 * ("Cannot read properties of undefined (reading 'includes')") the moment
 * the admin shell renders after login.
 *
 * `user.role` must already be a populated Role document (not a bare
 * ObjectId) before calling this, since `.permissions` is read off it.
 */
async function buildAuthUserDto(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: await encryption.decrypt(user.email_enc),
    role: user.role.name,
    permissions: user.role.permissions,
  };
}

async function login({ email, password }, ipAddress) {
  const emailBidx = await blindIndex.computeBlindIndex(email);
  const user = await User.findOne({ email_bidx: emailBidx }).select('+passwordHash +mfaSecret_enc').populate('role');

  if (!user) {
    await logAudit({ action: 'auth.login_failed', metadata: { reason: 'not_found' }, ipAddress });
    throw INVALID_CREDENTIALS();
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await logAudit({ actor: user._id, action: 'auth.login_failed', metadata: { reason: 'bad_password' }, ipAddress });
    throw INVALID_CREDENTIALS();
  }

  if (!user.isActive) {
    await logAudit({ actor: user._id, action: 'auth.login_failed', metadata: { reason: 'deactivated' }, ipAddress });
    throw ApiError.forbidden('This account has been deactivated');
  }

  // Toggleable enforcement (client decision: OFF by default, flip via env when ready)
  if (env.ENFORCE_MFA_FOR_SUPER_ADMIN && user.role.name === 'Super Admin' && !user.mfaEnabled) {
    throw ApiError.forbidden('MFA setup is required for Super Admin accounts before login is permitted');
  }

  if (user.mfaEnabled) {
    // Partial session — cannot be used as a bearer token for any protected route
    // (auth.middleware.js explicitly rejects tokens with mfaPending: true).
    const mfaToken = signAccessToken({ sub: user._id.toString(), mfaPending: true });
    await logAudit({ actor: user._id, action: 'auth.login_mfa_challenge', ipAddress });
    return { mfaRequired: true, mfaToken };
  }

  return issueSessionAndRecordLogin(user, ipAddress);
}

async function verifyMfa({ userId, code }, ipAddress) {
  const user = await User.findById(userId).select('+mfaSecret_enc').populate('role');
  if (!user || !user.mfaEnabled || !user.mfaSecret_enc) {
    throw ApiError.unauthorized('MFA is not configured for this account');
  }

  const secret = await encryption.decrypt(user.mfaSecret_enc);
  const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });

  if (!isValid) {
    await logAudit({ actor: user._id, action: 'auth.mfa_failed', ipAddress });
    throw ApiError.unauthorized('Invalid MFA code');
  }

  return issueSessionAndRecordLogin(user, ipAddress);
}

async function issueSessionAndRecordLogin(user, ipAddress) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role._id.toString(),
  });
  const refreshToken = signRefreshToken({ sub: user._id.toString() });

  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  user.lastLogin = new Date();
  await user.save();

  await logAudit({ actor: user._id, action: 'auth.login_success', ipAddress });

  return {
    accessToken,
    refreshToken,
    user: await buildAuthUserDto(user),
  };
}

async function refresh({ refreshToken }) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const user = await User.findById(decoded.sub).populate('role');

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash && t.expiresAt > new Date());
  if (!stored) {
    // Server-side revocation check — FR-AUTH-05. Covers logout AND admin-forced revocation.
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  // `user` was previously returned without this DTO, so AuthProvider's
  // doRefresh() left the frontend's `user` state as null on every hard
  // reload of /admin (result.user was undefined), which silently hid every
  // permission-gated nav item and blanked the signed-in name despite a
  // perfectly valid session.
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role._id.toString() });
  return { accessToken, user: await buildAuthUserDto(user) };
}

/**
 * Logout invalidates ALL server-side refresh sessions for this user (safe default —
 * the API spec's body is empty, so there's no single token to target selectively).
 */
async function logout(userId) {
  await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
  await logAudit({ actor: userId, action: 'auth.logout' });
}

async function forgotPassword({ email }) {
  const emailBidx = await blindIndex.computeBlindIndex(email);
  const user = await User.findOne({ email_bidx: emailBidx });

  // Always behave identically regardless of match (FR-AUTH-06 / API spec: generic 202)
  if (!user) return;

  const rawToken = generateOpaqueToken();
  user.passwordResetTokenHash = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    toName: user.name,
    subject: 'Liko Security Training — Password Reset',
    html: `<p>Hi ${user.name},</p><p>A password reset was requested for your admin account. This link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });

  await logAudit({ actor: user._id, action: 'auth.password_reset_requested' });
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('Reset token is invalid or has expired');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.refreshTokens = []; // force re-login on all devices after a password reset
  await user.save();

  await logAudit({ actor: user._id, action: 'auth.password_reset_completed' });
}

module.exports = {
  login,
  verifyMfa,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  MFA_PENDING_TOKEN_TTL,
};
