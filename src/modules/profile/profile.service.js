'use strict';

const User = require('../users/user.model');
const { toSafeJSON } = require('../users/user.service');
const encryption = require('../../shared/security/encryption');
const blindIndex = require('../../shared/security/blindIndex');
const { hashPassword, verifyPassword } = require('../auth/auth.utils');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

/**
 * Self-service profile — deliberately separate from users.service.js's
 * updateUser: this never accepts `role`, and only ever acts on the
 * authenticated caller's own id (req.user.id), never a :id route param.
 * There is no permission gate on these routes (see profile.routes.js) —
 * every authenticated user, regardless of role/permissions, can view and
 * edit their own profile and change their own password.
 */
async function getOwnProfile(userId) {
  const user = await User.findById(userId).populate('role', 'name permissions');
  if (!user) throw ApiError.notFound('User not found');
  return toSafeJSON(user);
}

async function updateOwnProfile(userId, updates) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (updates.name) user.name = updates.name;
  if (updates.phone !== undefined) user.phone = updates.phone || null;

  if (updates.email) {
    const emailBidx = await blindIndex.computeBlindIndex(updates.email);
    const existing = await User.findOne({ email_bidx: emailBidx, _id: { $ne: userId } });
    if (existing) throw ApiError.conflict('A user with this email already exists');
    user.email_enc = await encryption.encrypt(updates.email);
    user.email_bidx = emailBidx;
  }

  await user.save();
  await logAudit({
    actor: userId,
    action: 'profile.updated',
    targetType: 'User',
    targetId: userId,
    metadata: { fields: Object.keys(updates) },
  });

  return toSafeJSON(await user.populate('role', 'name permissions'));
}

async function changeOwnPassword(userId, currentPassword, newPassword) {
  // passwordHash has `select: false` on the schema (user.model.js) — must
  // explicitly select it here, toSafeJSON's normal User.findById never
  // includes it.
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) throw ApiError.badRequest('Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  // Revoke every other session, same as an admin-initiated deactivation —
  // a password change should immediately invalidate refresh tokens issued
  // under the old password, forcing re-login everywhere else signed in.
  user.refreshTokens = [];
  await user.save();

  await logAudit({ actor: userId, action: 'profile.password_changed', targetType: 'User', targetId: userId });
}

module.exports = { getOwnProfile, updateOwnProfile, changeOwnPassword };
