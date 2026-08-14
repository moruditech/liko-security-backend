'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const invoiceValidation = require('./invoice.validation');
const invoiceController = require('./invoice.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/:applicationId',
  can(['invoices:issue', 'applications:read'], 'any'),
  validate(invoiceValidation.applicationIdParam, 'params'),
  invoiceController.listForApplication
);

router.post(
  '/:id/resend',
  can('invoices:issue'),
  validate(invoiceValidation.invoiceIdParam, 'params'),
  invoiceController.resend
);

module.exports = router;
