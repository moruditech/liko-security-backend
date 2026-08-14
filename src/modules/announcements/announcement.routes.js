'use strict';

const express = require('express');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const announcementValidation = require('./announcement.validation');
const announcementService = require('./announcement.service');

const listPublic = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listPublicAnnouncements();
  new ApiResponse(announcements, 'Announcements retrieved').send(res, 200);
});

// Was missing — Frontend TAD §14 gap #2.
const listAllAdmin = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listAllAnnouncementsAdmin();
  new ApiResponse(announcements, 'Announcements retrieved').send(res, 200);
});

// Was missing.
const getById = asyncHandler(async (req, res) => {
  const announcement = await announcementService.getAnnouncementById(req.params.id);
  new ApiResponse(announcement, 'Announcement retrieved').send(res, 200);
});

const create = asyncHandler(async (req, res) => {
  const announcement = await announcementService.createAnnouncement(req.body, req.user.id);
  new ApiResponse(announcement, 'Announcement created').send(res, 201);
});

const update = asyncHandler(async (req, res) => {
  const announcement = await announcementService.updateAnnouncement(req.params.id, req.body, req.user.id);
  new ApiResponse(announcement, 'Announcement updated').send(res, 200);
});

// Was missing — PUT full replace.
const replace = asyncHandler(async (req, res) => {
  const announcement = await announcementService.replaceAnnouncement(req.params.id, req.body, req.user.id);
  new ApiResponse(announcement, 'Announcement replaced').send(res, 200);
});

// Was missing.
const remove = asyncHandler(async (req, res) => {
  await announcementService.deleteAnnouncement(req.params.id, req.user.id);
  res.status(204).send();
});

// GET /announcements — public, active + unexpired
const publicRouter = express.Router();
publicRouter.get('/', listPublic);

// /admin/announcements — content:manage
const adminRouter = express.Router();
adminRouter.use(authenticate, can('content:manage'));
adminRouter.get('/', listAllAdmin); // was missing — Frontend TAD §14 gap #2
adminRouter.get('/:id', validate(announcementValidation.paramsId, 'params'), getById); // was missing
adminRouter.post('/', validate(announcementValidation.createAnnouncement), create);
adminRouter.put(
  '/:id',
  validate(announcementValidation.paramsId, 'params'),
  validate(announcementValidation.replaceAnnouncement),
  replace
); // was missing
adminRouter.patch('/:id', validate(announcementValidation.paramsId, 'params'), validate(announcementValidation.updateAnnouncement), update);
adminRouter.delete('/:id', validate(announcementValidation.paramsId, 'params'), remove); // was missing

module.exports = { publicRouter, adminRouter };
