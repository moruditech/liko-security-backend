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
      // Emit {field, message} objects so the frontend can map each error to the
      // correct field and show it inline. d.path is an array like ['address','city']
      // — joined with '.' to produce 'address.city', matching how ApplicationForm
      // does byField[fieldError.field]. Previously this was plain strings, which
      // meant the frontend's byField map was always empty and users only ever saw
      // the generic banner with no indication of which field was wrong.
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return next(ApiError.badRequest('Please check the form and try again.', errors));
    }

    req[property] = value;
    return next();
  };
}

module.exports = validate;
