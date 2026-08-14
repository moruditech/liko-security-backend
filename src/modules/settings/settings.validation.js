'use strict';

const Joi = require('joi');

const updateSettings = Joi.object({
  bankAccounts: Joi.array().items(
    Joi.object({
      bankName: Joi.string().trim().required(),
      accountNumber: Joi.string().trim().required(),
      branchCode: Joi.string().trim().required(),
    })
  ),
  psiraRegistrationFee: Joi.number().min(0),
  whatsappNumber: Joi.string().trim().allow(''),
  contactPhone: Joi.string().trim().allow(''),
}).min(1);

module.exports = { updateSettings };
