'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const applicationIdParam = Joi.object({ applicationId: objectId.required() });
const invoiceIdParam = Joi.object({ id: objectId.required() });

module.exports = { applicationIdParam, invoiceIdParam };
