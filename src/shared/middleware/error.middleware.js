'use strict';

const env = require('../../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Centralized error handler — the last middleware mounted in app.js.
 * Every error, whether an ApiError thrown deliberately or an unexpected
 * exception, funnels through here into the standard failure envelope.
 * Never leaks stack traces or internal details in production (TAD §15).
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error fallback, in case something slips past Joi/Zod
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors || {}).map((e) => e.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier format';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate resource';
  }

  // Log full detail server-side regardless of env — but NEVER include req.body
  // wholesale, since it may contain PII fields headed for encryption.
  // eslint-disable-next-line no-console
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);
  if (!env.isProduction && err.stack) {
    // eslint-disable-next-line no-console
    console.error(err.stack);
  }

  const body = { success: false, message, errors };

  if (statusCode === 500 && env.isProduction) {
    body.message = 'Internal server error';
    body.errors = [];
  }

  res.status(statusCode).json(body);
}

module.exports = errorMiddleware;
