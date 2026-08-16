'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const ApiError = require('../../shared/utils/ApiError');
const applicationService = require('./application.service');
const invoiceService = require('../invoices/invoice.service');
const { sendEmail } = require('../../shared/utils/mailer');
const { APPLICATION_STATUS } = require('../../shared/constants/enums');

/**
 * multipart/form-data delivers nested/array fields as JSON strings by convention
 * on this API — parsed here before Joi validation runs on req.body.
 */
function normalizeMultipartBody(req, res, next) {
  try {
    if (typeof req.body.address === 'string') {
      req.body.address = JSON.parse(req.body.address);
    }
    if (typeof req.body.coursesSelected === 'string') {
      req.body.coursesSelected = JSON.parse(req.body.coursesSelected);
    }
  } catch (err) {
    return next(ApiError.badRequest('address and coursesSelected must be valid JSON'));
  }
  next();
}

const submit = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('ID document is required');
  }

  const { application } = await applicationService.submitApplication(req.body, req.file);

  // Respond immediately so the applicant sees the success popup without
  // waiting for email delivery. Both emails (acknowledgement + invoice) are
  // sent fire-and-forget — a Mailjet delay or failure never blocks the
  // submission response or causes the popup not to appear.
  new ApiResponse(
    { referenceCode: application.referenceCode, applicationId: application._id },
    'Application submitted successfully'
  ).send(res, 201);

  // Fire and forget — intentionally not awaited. Errors are caught and logged
  // so they don't surface as unhandled rejections.
  invoiceService.generateProformaInvoice(application._id).catch((err) => {
    console.error('[invoice] Failed to create proforma invoice record', { applicationId: application._id, err });
  });

  invoiceService.sendApplicationEmails(application._id).catch((err) => {
    console.error('[email] Failed to send application emails', { applicationId: application._id, err });
  });
});

const list = asyncHandler(async (req, res) => {
  const result = await applicationService.listApplications(req.query);
  new ApiResponse(result, 'Applications retrieved').send(res, 200);
});

const getById = asyncHandler(async (req, res) => {
  const application = await applicationService.getApplicationById(req.params.id);
  new ApiResponse(application, 'Application retrieved').send(res, 200);
});

const updateStatus = asyncHandler(async (req, res) => {
  req.auditTarget = req.params.id;
  const application = await applicationService.updateApplicationStatus(req.params.id, req.body.status, req.user.id);

  if (application.status === APPLICATION_STATUS.PAYMENT_VERIFIED) {
    await invoiceService.generateOfficialInvoice(application._id);
  }

  new ApiResponse(application, 'Application status updated').send(res, 200);
});

const sendCustomEmail = asyncHandler(async (req, res) => {
  const application = await applicationService.getApplicationById(req.params.id);
  await sendEmail({
    to: application.email,
    toName: `${application.firstName} ${application.lastName}`,
    subject: req.body.subject,
    html: `<p>${req.body.message.replace(/\n/g, '</p><p>')}</p>`,
  });
  res.status(202).json({ success: true, data: null, message: 'Email sent' });
});

const getSignedDocument = asyncHandler(async (req, res) => {
  const url = await applicationService.getSignedDocumentUrl(req.params.id);
  new ApiResponse({ url }, 'Signed document URL generated').send(res, 200);
});

module.exports = { normalizeMultipartBody, submit, list, getById, updateStatus, sendCustomEmail, getSignedDocument };
