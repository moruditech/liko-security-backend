'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const userService = require('./user.service');

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  new ApiResponse(users, 'Users retrieved').send(res, 200);
});

// Was missing.
const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  new ApiResponse(user, 'User retrieved').send(res, 200);
});

const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user.id);
  new ApiResponse(user, 'User created').send(res, 201);
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user.id);
  new ApiResponse(user, 'User updated').send(res, 200);
});

const deactivate = asyncHandler(async (req, res) => {
  await userService.deactivateUser(req.params.id, req.user.id);
  new ApiResponse(null, 'User deactivated').send(res, 200);
});

module.exports = { list, getById, create, update, deactivate };
