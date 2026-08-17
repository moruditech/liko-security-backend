'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const profileService = require('./profile.service');

const getProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.getOwnProfile(req.user.id);
  new ApiResponse(profile, 'Profile retrieved').send(res, 200);
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.updateOwnProfile(req.user.id, req.body);
  new ApiResponse(profile, 'Profile updated').send(res, 200);
});

const changePassword = asyncHandler(async (req, res) => {
  await profileService.changeOwnPassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  new ApiResponse(null, 'Password changed').send(res, 200);
});

module.exports = { getProfile, updateProfile, changePassword };
