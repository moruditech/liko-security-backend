'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Generic Joi schema validation middleware factory. Every module's validation
 * file exports Joi schemas; routes wire them in here. Runs BEFORE any DB
 * interaction (TAD §15).
 *
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} property
 */
function validate(schema, property = 'body') {
  return function validateMiddleware(req, res, next) {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => d.message.replace(/"/g, ''));
      return next(ApiError.badRequest('Validation failed', errors));
    }

    req[property] = value;
    return next();
  };
}

module.exports = validate;
