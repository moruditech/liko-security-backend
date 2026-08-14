'use strict';

const express = require('express');
const validate = require('../../shared/middleware/validate.middleware');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { strictLimiter } = require('../../shared/middleware/rateLimiter.middleware');
const { requireMfaPendingSession } = require('./mfaSession.middleware');
const authValidation = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

// API spec B.1 — exact method/path/auth match
router.post('/login', strictLimiter, validate(authValidation.login), authController.login);
router.post('/refresh', validate(authValidation.refresh), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', strictLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword);
router.post('/mfa/verify', requireMfaPendingSession, validate(authValidation.mfaVerify), authController.mfaVerify);

module.exports = router;
