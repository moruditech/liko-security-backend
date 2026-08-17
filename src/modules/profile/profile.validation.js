'use strict';

const Joi = require('joi');

const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().max(30).allow(''),
  email: Joi.string().email(),
}).min(1);

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(10).required(),
});

module.exports = { updateProfile, changePassword };
