'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');
const { INQUIRY_STATUS } = require('../../shared/constants/enums');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const submitInquiry = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().min(7).max(20).allow('', null),
  message: Joi.string().trim().min(2).max(5000).required(),
});

const listQuery = Joi.object({
  status: Joi.string().valid(...Object.values(INQUIRY_STATUS)),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const reply = Joi.object({
  message: Joi.string().trim().min(2).max(5000).required(),
});

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { submitInquiry, listQuery, reply, paramsId };
