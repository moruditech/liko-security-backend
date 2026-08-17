'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createUser = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().max(30).allow('').optional(),
  email: Joi.string().email().required(),
  role: objectId.required(), // FR-USR-02: cannot be null
  password: Joi.string().min(10).required(),
});

const updateUser = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().max(30).allow(''),
  email: Joi.string().email(),
  role: objectId,
}).min(1);

const paramsId = Joi.object({
  id: objectId.required(),
});

module.exports = { createUser, updateUser, paramsId };
