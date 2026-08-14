'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');
const { COURSE_GRADE } = require('../../shared/constants/enums');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const createCourse = Joi.object({
  grade: Joi.string().valid(...Object.values(COURSE_GRADE)).required(),
  title: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().allow('').max(2000),
  duration: Joi.string().trim().required(),
  fee: Joi.number().min(0).required(),
});

const updateCourse = Joi.object({
  grade: Joi.string().valid(...Object.values(COURSE_GRADE)),
  title: Joi.string().trim().min(2).max(150),
  description: Joi.string().allow('').max(2000),
  duration: Joi.string().trim(),
  fee: Joi.number().min(0),
  isActive: Joi.boolean(),
}).min(1);

const createIntake = Joi.object({
  title: Joi.string().trim().min(2).max(150).required(),
  startDate: Joi.date().iso().required(),
  applicableGrades: Joi.array().items(Joi.string().valid(...Object.values(COURSE_GRADE))).min(1).required(),
});

const updateIntake = Joi.object({
  title: Joi.string().trim().min(2).max(150),
  startDate: Joi.date().iso(),
  applicableGrades: Joi.array().items(Joi.string().valid(...Object.values(COURSE_GRADE))).min(1),
  isActive: Joi.boolean(),
}).min(1);

const paramsId = Joi.object({ id: objectId.required() });

module.exports = { createCourse, updateCourse, createIntake, updateIntake, paramsId };
