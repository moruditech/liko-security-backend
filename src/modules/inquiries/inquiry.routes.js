'use strict';

const express = require('express');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const { publicSubmissionLimiter } = require('../../shared/middleware/rateLimiter.middleware');
const inquiryValidation = require('./inquiry.validation');
const inquiryService = require('./inquiry.service');

const submit = asyncHandler(async (req, res) => {
  await inquiryService.submitInquiry(req.body);
  res.status(202).json({ success: true, data: null, message: 'Inquiry received' });
});

const list = asyncHandler(async (req, res) => {
  const result = await inquiryService.listInquiries(req.query);
  new ApiResponse(result, 'Inquiries retrieved').send(res, 200);
});

// Was missing.
const getById = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.getInquiryById(req.params.id);
  new ApiResponse(inquiry, 'Inquiry retrieved').send(res, 200);
});

const reply = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.replyToInquiry(req.params.id, req.body.message, req.user.id, req.user.name);
  res.status(202).json({ success: true, data: inquiry, message: 'Reply sent' });
});

// POST /inquiries — public, rate-limited (FR-INQ-01)
const publicRouter = express.Router();
publicRouter.post('/', publicSubmissionLimiter, validate(inquiryValidation.submitInquiry), submit);

// /admin/inquiries — inquiries:manage
const adminRouter = express.Router();
adminRouter.use(authenticate, can('inquiries:manage'));
adminRouter.get('/', validate(inquiryValidation.listQuery, 'query'), list);
adminRouter.get('/:id', validate(inquiryValidation.paramsId, 'params'), getById);
adminRouter.post('/:id/reply', validate(inquiryValidation.paramsId, 'params'), validate(inquiryValidation.reply), reply);

module.exports = { publicRouter, adminRouter };
