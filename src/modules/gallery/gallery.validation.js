'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');
const { GALLERY_CATEGORIES } = require('../../shared/constants/enums');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createGalleryItem = Joi.object({
  title: Joi.string().trim().allow('').max(150),
  category: Joi.string().valid(...GALLERY_CATEGORIES).required(),
  mediaType: Joi.string().valid('image', 'video').required(),
});

// PUT semantics — category/mediaType required (full replace); media file itself
// is optional (handled as a separate multipart field, swapped in if provided).
const updateGalleryItem = Joi.object({
  title: Joi.string().trim().allow('').max(150),
  category: Joi.string().valid(...GALLERY_CATEGORIES).required(),
  mediaType: Joi.string().valid('image', 'video').required(),
  isActive: Joi.boolean(),
});

const reorder = Joi.object({ order: Joi.number().integer().min(0).required() });

const listQuery = Joi.object({ category: Joi.string().valid(...GALLERY_CATEGORIES) });

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { createGalleryItem, updateGalleryItem, reorder, listQuery, paramsId };
