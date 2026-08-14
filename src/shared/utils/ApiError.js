'use strict';

/**
 * Standard application error. Thrown from anywhere in the service/controller layers;
 * caught centrally by error.middleware.js and shaped into the standard failure envelope.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {Array<string|object>} errors - field-level validation errors, if any
   * @param {boolean} isOperational - true for expected/handled errors (vs bugs)
   */
  constructor(statusCode, message, errors = [], isOperational = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, [], false);
  }
}

module.exports = ApiError;
