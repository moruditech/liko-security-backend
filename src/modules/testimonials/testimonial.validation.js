'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');
const { COURSE_GRADE } = require('../../shared/constants/enums');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createTestimonial = Joi.object({
  studentName: Joi.string().trim().min(2).max(100).required(),
  courseGrade: Joi.string().valid(...Object.values(COURSE_GRADE)).required(),
  quote: Joi.string().trim().min(2).max(2000).required(),
  isFeatured: Joi.boolean().default(false),
});

// PUT semantics — studentName/courseGrade/quote required (full replace); photo is
// handled separately as an optional file upload, not part of this body schema.
const replaceTestimonial = Joi.object({
  studentName: Joi.string().trim().min(2).max(100).required(),
  courseGrade: Joi.string().valid(...Object.values(COURSE_GRADE)).required(),
  quote: Joi.string().trim().min(2).max(2000).required(),
  isFeatured: Joi.boolean(),
});

const updateTestimonial = Joi.object({
  studentName: Joi.string().trim().min(2).max(100),
  courseGrade: Joi.string().valid(...Object.values(COURSE_GRADE)),
  quote: Joi.string().trim().min(2).max(2000),
  isFeatured: Joi.boolean(),
}).min(1);

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { createTestimonial, updateTestimonial, replaceTestimonial, paramsId };
