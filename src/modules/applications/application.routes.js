'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const { checkOwnership } = require('../../shared/middleware/ownership.middleware');
const { publicSubmissionLimiter } = require('../../shared/middleware/rateLimiter.middleware');
const { uploadSingle, validateFileContent } = require('../../shared/middleware/upload.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiError = require('../../shared/utils/ApiError');
const applicationValidation = require('./application.validation');
const applicationController = require('./application.controller');
const Application = require('./application.model');
const { APPLICATION_STATUS } = require('../../shared/constants/enums');

const router = express.Router();

// POST /applications — public, no auth (FR-APP-01)
router.post(
  '/',
  publicSubmissionLimiter,
  uploadSingle('idDocument'),
  validateFileContent('idDocument'),
  applicationController.normalizeMultipartBody,
  validate(applicationValidation.submitApplication),
  applicationController.submit
);

// GET /applications — applications:read (FR-APP-07)
router.get(
  '/',
  authenticate,
  can('applications:read'),
  validate(applicationValidation.listApplicationsQuery, 'query'),
  applicationController.list
);

// GET /applications/:id — applications:read + ownership
router.get(
  '/:id',
  authenticate,
  can('applications:read'),
  validate(applicationValidation.paramsId, 'params'),
  checkOwnership(Application),
  applicationController.getById
);

/**
 * PATCH /applications/:id/status — applications:write for most transitions,
 * but invoices:issue specifically for the payment_verified transition (API spec B.3).
 * Also enforces FR-APP-12: totalAmount is never a directly editable field here.
 */
const requireStatusTransitionPermission = asyncHandler(async (req, res, next) => {
  const targetsPaymentVerified = req.body.status === APPLICATION_STATUS.PAYMENT_VERIFIED;
  const requiredPermission = targetsPaymentVerified ? 'invoices:issue' : 'applications:write';

  if (!req.user.permissions.includes(requiredPermission)) {
    throw ApiError.forbidden(`Missing required permission: ${requiredPermission}`);
  }
  next();
});

router.patch(
  '/:id/status',
  authenticate,
  validate(applicationValidation.paramsId, 'params'),
  validate(applicationValidation.updateStatus),
  requireStatusTransitionPermission,
  checkOwnership(Application, {
    // FR-APP-12: totalAmount can never be set directly via this route, by any role
    forbiddenFieldsByRole: {
      Registrar: ['totalAmount'],
      Finance: ['totalAmount'],
      'Super Admin': [], // Super Admin still can't set it — enforced below regardless of role map
    },
  }),
  asyncHandler(async (req, res, next) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'totalAmount')) {
      return next(ApiError.forbidden("'totalAmount' cannot be set directly via the status update route"));
    }
    next();
  }),
  applicationController.updateStatus
);

// POST /applications/:id/email — applications:write
router.post(
  '/:id/email',
  authenticate,
  can('applications:write'),
  validate(applicationValidation.paramsId, 'params'),
  validate(applicationValidation.sendEmail),
  applicationController.sendCustomEmail
);

// GET /applications/:id/document — applications:read + ownership (FR-APP-11)
router.get(
  '/:id/document',
  authenticate,
  can('applications:read'),
  validate(applicationValidation.paramsId, 'params'),
  checkOwnership(Application),
  applicationController.getSignedDocument
);

module.exports = router;
