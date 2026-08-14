'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');
const { ID_TYPE, APPLICATION_STATUS } = require('../../shared/constants/enums');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

// multipart/form-data — fields arrive as strings; coursesSelected as a JSON-stringified
// array or repeated form field, normalized in the controller before this validates.
const submitApplication = Joi.object({
  firstName: Joi.string().trim().min(2).max(100).required(),
  lastName: Joi.string().trim().min(2).max(100).required(),
  idType: Joi.string().valid(...Object.values(ID_TYPE)).required(),
  idNumber: Joi.string().trim().required(), // format checked separately per idType (FR-APP-02)
  phone: Joi.string().trim().min(7).max(20).required(),
  whatsapp: Joi.string().trim().min(7).max(20).allow('', null),
  email: Joi.string().email().required(),
  address: Joi.object({
    street: Joi.string().trim().allow(''),
    suburb: Joi.string().trim().allow(''),
    city: Joi.string().trim().allow(''),
    province: Joi.string().trim().allow(''),
    postalCode: Joi.string().trim().allow(''),
  }).required(),
  coursesSelected: Joi.array().items(objectId).min(1).required(),
  preferredIntake: objectId.required(),
  // POPIA consent — must be explicitly true, not just present/truthy-ish.
  // Joi.boolean() accepts the string "true"/"false" from multipart form
  // fields by default (same pattern already used for testimonials' isFeatured).
  consentGiven: Joi.boolean().valid(true).required().messages({
    'any.only': 'Consent to the processing of personal information is required to submit an application',
    'any.required': 'Consent to the processing of personal information is required to submit an application',
  }),
});

const listApplicationsQuery = Joi.object({
  status: Joi.string().valid(...Object.values(APPLICATION_STATUS)),
  courseId: objectId,
  intakeId: objectId,
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const updateStatus = Joi.object({
  status: Joi.string().valid(...Object.values(APPLICATION_STATUS)).required(),
});

const sendEmail = Joi.object({
  subject: Joi.string().trim().min(2).max(200).required(),
  message: Joi.string().trim().min(2).max(5000).required(),
});

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { submitApplication, listApplicationsQuery, updateStatus, sendEmail, paramsId };
