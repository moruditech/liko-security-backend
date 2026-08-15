'use strict';

const User = require('./user.model');
const Role = require('../roles/role.model');
const encryption = require('../../shared/security/encryption');
const blindIndex = require('../../shared/security/blindIndex');
const { hashPassword } = require('../auth/auth.utils');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

/**
 * Decrypts a user document's email for admin-facing display. Never returned
 * from list endpoints without going through this — email_enc/email_bidx are
 * internal storage detail, not API surface.
 */
async function toSafeJSON(userDoc) {
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  const email = await encryption.decrypt(obj.email_enc);
  return {
    id: obj._id,
    name: obj.name,
    email,
    // obj.role is the populated Role subdocument ({_id, name, permissions})
    // at every call site below, never a bare ObjectId — trimmed to {id, name}
    // since that's all the admin UI needs (table display + the role <select>
    // in UserEditForm, matched by id). Sending the raw object crashed
    // UserManagementTable, which rendered it directly as a string.
    role: { id: obj.role._id.toString(), name: obj.role.name },
    mfaEnabled: obj.mfaEnabled,
    active: obj.isActive,
    lastLogin: obj.lastLogin,
    createdAt: obj.createdAt,
  };
}

async function listUsers() {
  const users = await User.find().populate('role', 'name permissions');
  return Promise.all(users.map(toSafeJSON));
}

// Was missing — admin panel needs to fetch a single user record to edit it.
async function getUserById(id) {
  const user = await User.findById(id).populate('role', 'name permissions');
  if (!user) throw ApiError.notFound('User not found');
  return toSafeJSON(user);
}

async function createUser({ name, email, role, password }, actorId) {
  const roleDoc = await Role.findById(role);
  if (!roleDoc) throw ApiError.badRequest('Role does not exist');

  const emailBidx = await blindIndex.computeBlindIndex(email);
  const existing = await User.findOne({ email_bidx: emailBidx });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const emailEnc = await encryption.encrypt(email);
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name,
    email_enc: emailEnc,
    email_bidx: emailBidx,
    role: roleDoc._id,
    passwordHash,
  });

  await logAudit({ actor: actorId, action: 'user.created', targetType: 'User', targetId: user._id });

  return toSafeJSON(await user.populate('role', 'name permissions'));
}

async function updateUser(id, updates, actorId) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  if (updates.name) user.name = updates.name;

  if (updates.email) {
    const emailBidx = await blindIndex.computeBlindIndex(updates.email);
    const existing = await User.findOne({ email_bidx: emailBidx, _id: { $ne: id } });
    if (existing) throw ApiError.conflict('A user with this email already exists');
    user.email_enc = await encryption.encrypt(updates.email);
    user.email_bidx = emailBidx;
  }

  if (updates.role) {
    const roleDoc = await Role.findById(updates.role);
    if (!roleDoc) throw ApiError.badRequest('Role does not exist');
    user.role = roleDoc._id;
  }

  await user.save();
  await logAudit({ actor: actorId, action: 'user.updated', targetType: 'User', targetId: id, metadata: { fields: Object.keys(updates) } });

  return toSafeJSON(await user.populate('role', 'name permissions'));
}

async function deactivateUser(id, actorId) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  user.isActive = false;
  user.refreshTokens = []; // immediately revoke all sessions
  await user.save();

  await logAudit({ actor: actorId, action: 'user.deactivated', targetType: 'User', targetId: id });
}

module.exports = { listUsers, getUserById, createUser, updateUser, deactivateUser, toSafeJSON };
