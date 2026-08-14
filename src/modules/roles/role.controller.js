'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const roleService = require('./role.service');

const list = asyncHandler(async (req, res) => {
  const roles = await roleService.listRoles();
  new ApiResponse(roles, 'Roles retrieved').send(res, 200);
});

// Was missing.
const getById = asyncHandler(async (req, res) => {
  const role = await roleService.getRoleById(req.params.id);
  new ApiResponse(role, 'Role retrieved').send(res, 200);
});

const create = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body, req.user.id);
  new ApiResponse(role, 'Role created').send(res, 201);
});

const updatePermissions = asyncHandler(async (req, res) => {
  const role = await roleService.updateRolePermissions(req.params.id, req.body.permissions, req.user.id);
  new ApiResponse(role, 'Role permissions updated').send(res, 200);
});

module.exports = { list, getById, create, updatePermissions };
