'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createAnnouncement = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  body: Joi.string().trim().min(2).max(5000).required(),
  publishAt: Joi.date().iso().allow(null),
  expiresAt: Joi.date().iso().allow(null),
});

const updateAnnouncement = Joi.object({
  title: Joi.string().trim().min(2).max(200),
  body: Joi.string().trim().min(2).max(5000),
  isActive: Joi.boolean(),
  publishAt: Joi.date().iso().allow(null),
  expiresAt: Joi.date().iso().allow(null),
}).min(1);

// PUT semantics — title/body required (full replace)
const replaceAnnouncement = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  body: Joi.string().trim().min(2).max(5000).required(),
  isActive: Joi.boolean(),
  publishAt: Joi.date().iso().allow(null),
  expiresAt: Joi.date().iso().allow(null),
});

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { createAnnouncement, updateAnnouncement, replaceAnnouncement, paramsId };
