'use strict';

const Role = require('./role.model');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

async function listRoles() {
  return Role.find().sort({ name: 1 });
}

// Was missing.
async function getRoleById(id) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

async function createRole({ name, permissions }, actorId) {
  const existing = await Role.findOne({ name });
  if (existing) throw ApiError.conflict('A role with this name already exists');

  const role = await Role.create({ name, permissions, isSystemRole: false });
  await logAudit({ actor: actorId, action: 'role.created', targetType: 'Role', targetId: role._id, metadata: { name } });
  return role;
}

async function updateRolePermissions(id, permissions, actorId) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');

  role.permissions = permissions;
  await role.save();

  await logAudit({ actor: actorId, action: 'role.permissions_updated', targetType: 'Role', targetId: id, metadata: { permissions } });
  return role;
}

/**
 * Not currently exposed via a route (API spec B.2 has no DELETE /roles/:id),
 * but guarded here regardless — defense in depth per FR-USR-04 in case a
 * delete route is added later without re-reading this requirement.
 */
async function deleteRole(id, actorId) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystemRole) {
    throw ApiError.forbidden('System-seeded default roles cannot be deleted');
  }
  await role.deleteOne();
  await logAudit({ actor: actorId, action: 'role.deleted', targetType: 'Role', targetId: id });
}

module.exports = { listRoles, getRoleById, createRole, updateRolePermissions, deleteRole };
