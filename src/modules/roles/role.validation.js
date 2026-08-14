'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');
const { PERMISSIONS } = require('../../shared/constants/enums');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createRole = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  permissions: Joi.array().items(Joi.string().valid(...PERMISSIONS)).min(1).required(), // FR-USR-03
});

const updateRolePermissions = Joi.object({
  permissions: Joi.array().items(Joi.string().valid(...PERMISSIONS)).min(1).required(),
});

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { createRole, updateRolePermissions, paramsId };
