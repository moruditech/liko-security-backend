'use strict';

/**
 * Wraps an async Express handler (or middleware) so any thrown error / rejected
 * promise is forwarded to next() instead of becoming an unhandled rejection.
 * Used on EVERY async controller and async middleware in the codebase.
 *
 * Usage: router.post('/x', asyncHandler(controller.createX))
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
