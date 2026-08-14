'use strict';

const express = require('express');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const { uploadSingle, validateFileContent, GALLERY_ALLOWED_MIME_TYPES } = require('../../shared/middleware/upload.middleware');
const galleryValidation = require('./gallery.validation');
const galleryService = require('./gallery.service');

const listPublic = asyncHandler(async (req, res) => {
  const items = await galleryService.listPublicItems(req.query.category);
  new ApiResponse(items, 'Gallery items retrieved').send(res, 200);
});

// Was missing — admin panel had no way to see deactivated items.
const listAllAdmin = asyncHandler(async (req, res) => {
  const items = await galleryService.listAllItemsAdmin(req.query.category);
  new ApiResponse(items, 'Gallery items retrieved').send(res, 200);
});

// Was missing.
const getById = asyncHandler(async (req, res) => {
  const item = await galleryService.getItemById(req.params.id);
  new ApiResponse(item, 'Gallery item retrieved').send(res, 200);
});

const create = asyncHandler(async (req, res) => {
  const item = await galleryService.createItem(req.body, req.file, req.user.id);
  new ApiResponse(item, 'Gallery item created').send(res, 201);
});

// Was missing — PUT full replace, media file swap optional.
const update = asyncHandler(async (req, res) => {
  const item = await galleryService.updateItem(req.params.id, req.body, req.file, req.user.id);
  new ApiResponse(item, 'Gallery item updated').send(res, 200);
});

const reorder = asyncHandler(async (req, res) => {
  const item = await galleryService.reorderItem(req.params.id, req.body.order, req.user.id);
  new ApiResponse(item, 'Gallery item reordered').send(res, 200);
});

const remove = asyncHandler(async (req, res) => {
  await galleryService.deleteItem(req.params.id, req.user.id);
  res.status(204).send();
});

// GET /gallery — public
const publicRouter = express.Router();
publicRouter.get('/', validate(galleryValidation.listQuery, 'query'), listPublic);

// /admin/gallery — gallery:manage
const adminRouter = express.Router();
adminRouter.use(authenticate, can('gallery:manage'));
adminRouter.get('/', validate(galleryValidation.listQuery, 'query'), listAllAdmin); // was missing
adminRouter.get('/:id', validate(galleryValidation.paramsId, 'params'), getById); // was missing
adminRouter.post(
  '/',
  uploadSingle('media'),
  validateFileContent('media', GALLERY_ALLOWED_MIME_TYPES),
  validate(galleryValidation.createGalleryItem),
  create
);
adminRouter.put(
  '/:id',
  uploadSingle('media'),
  validateFileContent('media', GALLERY_ALLOWED_MIME_TYPES),
  validate(galleryValidation.paramsId, 'params'),
  validate(galleryValidation.updateGalleryItem),
  update
); // was missing
adminRouter.patch('/:id/reorder', validate(galleryValidation.paramsId, 'params'), validate(galleryValidation.reorder), reorder);
adminRouter.delete('/:id', validate(galleryValidation.paramsId, 'params'), remove);

module.exports = { publicRouter, adminRouter };
