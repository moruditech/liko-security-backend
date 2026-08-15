'use strict';

const Joi = require('joi');

const login = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

const refresh = Joi.object({
  // Optional here deliberately: browser clients rely on the httpOnly refresh
  // cookie (see auth.controller.js), only non-browser API consumers pass this
  // in the body. auth.controller.js's refresh handler rejects the request if
  // neither source has a token.
  refreshToken: Joi.string().optional(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(10).required(),
});

const mfaVerify = Joi.object({
  code: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    // Joi's default pattern-failure message echoes the submitted value
    // ("code" with value "12a456" fails to match...) which would then flow
    // into error.middleware.js's server-side log via err.message. Overriding
    // it keeps a short-lived MFA code attempt out of logs entirely.
    .messages({
      'string.pattern.base': '"code" must be a 6-digit numeric code',
      'string.length': '"code" must be a 6-digit numeric code',
    }),
});

module.exports = { login, refresh, forgotPassword, resetPassword, mfaVerify };
