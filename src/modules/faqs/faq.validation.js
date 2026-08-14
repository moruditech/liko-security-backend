'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createFaq = Joi.object({
  question: Joi.string().trim().min(2).max(300).required(),
  answer: Joi.string().trim().min(2).max(3000).required(),
});

// PUT semantics — question/answer required (full replace), isActive/order optional
const replaceFaq = Joi.object({
  question: Joi.string().trim().min(2).max(300).required(),
  answer: Joi.string().trim().min(2).max(3000).required(),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0),
});

const updateFaq = Joi.object({
  question: Joi.string().trim().min(2).max(300),
  answer: Joi.string().trim().min(2).max(3000),
  isActive: Joi.boolean(),
}).min(1);

const reorder = Joi.object({ order: Joi.number().integer().min(0).required() });

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { createFaq, updateFaq, replaceFaq, reorder, paramsId };
