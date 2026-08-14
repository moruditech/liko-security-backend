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
 * on this API (documented for frontend integration) — parsed here before Joi
 * validation runs on req.body.
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
    throw ApiError.badRequest('ID document is required'); // FR-APP-03
  }

  const { application } = await applicationService.submitApplication(req.body, req.file);

  // FR-APP-06 / NFR-PERF-03: pro-forma invoice PDF generated and emailed within
  // this request. If this step fails, the application itself still exists and
  // succeeded — we surface the error rather than silently swallowing it, since
  // the applicant needs their reference code/PDF, but the submission is not rolled back.
  await invoiceService.generateProformaInvoice(application._id);

  new ApiResponse(
    { referenceCode: application.referenceCode, applicationId: application._id },
    'Application submitted successfully'
  ).send(res, 201);
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
  req.auditTarget = req.params.id; // consumed by auditAction if chained; service also logs directly
  const application = await applicationService.updateApplicationStatus(req.params.id, req.body.status, req.user.id);

  // FR-APP-09 / FR-INV-02: official invoice generated + emailed on payment_verified.
  // generateOfficialInvoice() is internally idempotent — safe even if this route
  // is somehow hit twice for the same transition.
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
