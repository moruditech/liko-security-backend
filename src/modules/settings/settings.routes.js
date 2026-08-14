'use strict';

const express = require('express');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const settingsValidation = require('./settings.validation');
const settingsService = require('./settings.service');

const getPublic = asyncHandler(async (req, res) => {
  const settings = await settingsService.getPublicSettings();
  new ApiResponse(settings, 'Settings retrieved').send(res, 200);
});

const update = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.user.id);
  new ApiResponse(settings, 'Settings updated').send(res, 200);
});

// GET /settings — public, safe subset
const publicRouter = express.Router();
publicRouter.get('/', getPublic);

// PATCH /admin/settings — users:manage (functionally Super Admin only, per API spec B.8)
const adminRouter = express.Router();
adminRouter.patch('/', authenticate, can('users:manage'), validate(settingsValidation.updateSettings), update);

module.exports = { publicRouter, adminRouter };
