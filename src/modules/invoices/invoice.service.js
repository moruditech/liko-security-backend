'use strict';

const Invoice = require('./invoice.model');
const applicationService = require('../applications/application.service');
const { getSettings } = require('../settings/settings.service');
const { renderPdf } = require('../../shared/utils/pdfRenderer');
const { uploadBuffer, getSignedUrl } = require('../../shared/utils/cloudinaryUpload');
const { sendEmail } = require('../../shared/utils/mailer');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');
const { INVOICE_TYPE } = require('../../shared/constants/enums');

const INVOICE_RESOURCE_TYPE = 'raw';

/**
 * Builds the shared template data (course breakdown, PSIRA fee, banking details)
 * from a decrypted application. Used by both invoice types.
 */
async function buildTemplateData(application) {
  const settings = await getSettings();
  return {
    applicantName: `${application.firstName} ${application.lastName}`,
    referenceCode: application.referenceCode,
    courses: application.coursesSelected.map((c) => ({ grade: c.grade, title: c.title, fee: c.fee })),
    psiraFee: settings.psiraRegistrationFee,
    totalAmount: application.totalAmount,
    bankAccounts: settings.bankAccounts,
    intakeTitle: application.preferredIntake ? application.preferredIntake.title : '',
    startDate: application.preferredIntake ? new Date(application.preferredIntake.startDate).toDateString() : '',
    issuedAt: new Date().toDateString(),
  };
}

/**
 * FR-APP-06 / FR-INV-01: triggered immediately on application submission.
 * NFR-PERF-03 requires the email to go out within 2 minutes — this runs
 * synchronously in the request lifecycle rather than a queued job, which is
 * acceptable at current expected volume (NFR-PERF-02: 20 concurrent submissions)
 * but flagged as a candidate for a job queue if submission volume grows.
 */
async function generateProformaInvoice(applicationId) {
  const application = await applicationService.getApplicationById(applicationId);
  const templateData = await buildTemplateData(application);

  const pdfBuffer = await renderPdf('proforma-invoice', templateData);
  const uploadResult = await uploadBuffer(pdfBuffer, {
    private: true,
    publicIdPrefix: `proforma-${application.referenceCode}`,
    resourceType: INVOICE_RESOURCE_TYPE,
  });

  const invoice = await Invoice.create({
    application: applicationId,
    type: INVOICE_TYPE.PROFORMA,
    referenceCode: application.referenceCode,
    amount: application.totalAmount,
    pdfUrl: uploadResult.public_id,
    issuedAt: new Date(),
  });

  await sendEmail({
    to: application.email,
    toName: templateData.applicantName,
    subject: `Liko Security Training — Registration Summary (${application.referenceCode})`,
    html: `<p>Dear ${templateData.applicantName},</p><p>Thank you for applying to Liko Security Training. Your registration summary and pro-forma invoice are attached, with payment reference <strong>${application.referenceCode}</strong>.</p>`,
    attachments: [
      { contentType: 'application/pdf', filename: `Proforma-Invoice-${application.referenceCode}.pdf`, base64Content: pdfBuffer.toString('base64') },
    ],
  });

  await logAudit({
    action: 'invoice.proforma_generated_and_sent',
    targetType: 'Invoice',
    targetId: invoice._id,
    metadata: { applicationId, referenceCode: application.referenceCode },
  });

  return invoice;
}

/**
 * FR-APP-09 / FR-INV-02: triggered on the payment_verified status transition.
 * IDEMPOTENT — re-triggering the same transition must never resend the email.
 * Enforced two ways: (1) the unique {application,type} index on Invoice prevents
 * a second official invoice row from ever being created; (2) we check for an
 * existing official invoice FIRST and short-circuit before doing any PDF/email
 * work, so a retry is a fast no-op rather than a caught duplicate-key error.
 */
async function generateOfficialInvoice(applicationId) {
  const existing = await Invoice.findOne({ application: applicationId, type: INVOICE_TYPE.OFFICIAL });
  if (existing) {
    // Idempotency guard — this transition has already been processed.
    return existing;
  }

  const application = await applicationService.getApplicationById(applicationId);
  const templateData = await buildTemplateData(application);

  const pdfBuffer = await renderPdf('official-invoice', templateData);
  const uploadResult = await uploadBuffer(pdfBuffer, {
    private: true,
    publicIdPrefix: `official-${application.referenceCode}`,
    resourceType: INVOICE_RESOURCE_TYPE,
  });

  let invoice;
  try {
    invoice = await Invoice.create({
      application: applicationId,
      type: INVOICE_TYPE.OFFICIAL,
      referenceCode: application.referenceCode,
      amount: application.totalAmount,
      pdfUrl: uploadResult.public_id,
      issuedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) {
      // Lost a race with a concurrent request for the same transition — fine,
      // the other request's invoice is authoritative. Don't double-send email.
      return Invoice.findOne({ application: applicationId, type: INVOICE_TYPE.OFFICIAL });
    }
    throw err;
  }

  await sendEmail({
    to: application.email,
    toName: templateData.applicantName,
    subject: `Liko Security Training — Payment Confirmed & Enrollment (${application.referenceCode})`,
    html: `<p>Dear ${templateData.applicantName},</p><p>Your payment has been verified and your enrollment is confirmed. Your official invoice/receipt is attached.</p>`,
    attachments: [
      { contentType: 'application/pdf', filename: `Official-Invoice-${application.referenceCode}.pdf`, base64Content: pdfBuffer.toString('base64') },
    ],
  });

  await logAudit({
    action: 'invoice.official_generated_and_sent',
    targetType: 'Invoice',
    targetId: invoice._id,
    metadata: { applicationId, referenceCode: application.referenceCode },
  });

  return invoice;
}

async function listInvoicesForApplication(applicationId) {
  return Invoice.find({ application: applicationId }).sort({ issuedAt: 1 });
}

/**
 * FR-INV-04: re-emails an EXISTING PDF without regenerating it — the durable
 * pdfUrl (Cloudinary public_id) makes this cheap. We re-fetch the applicant's
 * email fresh (rather than trusting a stale value) since email is encrypted
 * and could theoretically have been corrected between issuance and resend.
 */
async function resendInvoice(invoiceId, actorId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const application = await applicationService.getApplicationById(invoice.application);
  const signedUrl = getSignedUrl(invoice.pdfUrl, { resourceType: INVOICE_RESOURCE_TYPE, expiresInSeconds: 600 });

  await sendEmail({
    to: application.email,
    toName: `${application.firstName} ${application.lastName}`,
    subject: `Liko Security Training — Your Invoice (${invoice.referenceCode})`,
    html: `<p>Dear ${application.firstName},</p><p>As requested, here is a link to your ${invoice.type === INVOICE_TYPE.OFFICIAL ? 'official' : 'pro-forma'} invoice (link expires in 10 minutes):</p><p><a href="${signedUrl}">${signedUrl}</a></p>`,
  });

  await logAudit({ actor: actorId, action: 'invoice.resent', targetType: 'Invoice', targetId: invoiceId });

  return invoice;
}

module.exports = { generateProformaInvoice, generateOfficialInvoice, listInvoicesForApplication, resendInvoice };
