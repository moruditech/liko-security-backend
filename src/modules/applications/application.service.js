'use strict';

const Application = require('./application.model');
// Pragmatic exception to the "no cross-module direct model imports" rule:
// course.service.js needs to call INTO application.service.js (to check
// whether an intake has linked applications before allowing deletion), so
// application.service.js importing course.service.js here would create a
// circular require. Importing the Course/Intake MODELS directly (read-only
// lookups only, never mutated from here) breaks the cycle at negligible cost.
const Course = require('../courses/course.model');
const Intake = require('../courses/intake.model');
const encryption = require('../../shared/security/encryption');
const blindIndex = require('../../shared/security/blindIndex');
const { generateReferenceCode } = require('../../shared/utils/generateReference');
const { isValidSAId, isValidPassport } = require('../../shared/utils/idValidation');
const { uploadBuffer, getSignedUrl } = require('../../shared/utils/cloudinaryUpload');
const { getPsiraRegistrationFee } = require('../settings/settings.service');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');
const { ID_TYPE, APPLICATION_STATUS, APPLICATION_STATUS_TRANSITIONS } = require('../../shared/constants/enums');

/**
 * Decrypts an application document's PII fields for authorized admin display
 * (FR-APP-07 list/filter, GET /applications/:id). Never returned undecrypted
 * to a route that doesn't need it — public routes never touch this.
 */
async function toDecryptedJSON(appDoc) {
  const obj = appDoc.toObject ? appDoc.toObject() : appDoc;

  const [firstName, lastName, idNumber, phone, whatsapp, email, street] = await Promise.all([
    encryption.decrypt(obj.firstName_enc),
    encryption.decrypt(obj.lastName_enc),
    encryption.decrypt(obj.idNumber_enc),
    encryption.decrypt(obj.phone_enc),
    encryption.decrypt(obj.whatsapp_enc),
    encryption.decrypt(obj.email_enc),
    encryption.decrypt(obj.address ? obj.address.street_enc : null),
  ]);

  return {
    id: obj._id,
    firstName,
    lastName,
    idType: obj.idType,
    idNumber,
    phone,
    whatsapp,
    email,
    address: obj.address
      ? {
          street,
          suburb: obj.address.suburb,
          city: obj.address.city,
          province: obj.address.province,
          postalCode: obj.address.postalCode,
        }
      : null,
    coursesSelected: obj.coursesSelected,
    preferredIntake: obj.preferredIntake,
    referenceCode: obj.referenceCode,
    status: obj.status,
    totalAmount: obj.totalAmount,
    consentGiven: obj.consentGiven,
    consentGivenAt: obj.consentGivenAt,
    statusHistory: obj.statusHistory,
    createdAt: obj.createdAt,
  };
}

function validateIdNumberFormat(idType, idNumber) {
  if (idType === ID_TYPE.SA_ID && !isValidSAId(idNumber)) {
    throw ApiError.badRequest('Please enter a valid South African ID number.');
  }
  if (idType === ID_TYPE.PASSPORT && !isValidPassport(idNumber)) {
    throw ApiError.badRequest('Invalid passport number format');
  }
}

async function computeTotalAmount(courseIds) {
  const courses = await Course.find({ _id: { $in: courseIds }, isActive: true });
  if (courses.length !== courseIds.length) {
    throw ApiError.badRequest('One or more selected courses are invalid or inactive');
  }
  const coursesFeeTotal = courses.reduce((sum, c) => sum + c.fee, 0);
  const psiraFee = await getPsiraRegistrationFee();
  return coursesFeeTotal + psiraFee;
}

/**
 * FR-APP-01→05: public application submission. PDF/email side effects are
 * wired in by applicationWorkflow.service.js (Phase 3) — this function's job
 * ends at "application successfully persisted."
 */
async function submitApplication(data, file) {
  validateIdNumberFormat(data.idType, data.idNumber);

  const intake = await Intake.findById(data.preferredIntake);
  if (!intake || !intake.isActive) {
    throw ApiError.badRequest('Selected intake is invalid or no longer active');
  }

  const totalAmount = await computeTotalAmount(data.coursesSelected);

  // Upload ID document to the PRIVATE Cloudinary folder — never public (TAD §14, FR-APP-11)
  const uploadResult = await uploadBuffer(file.buffer, { private: true, publicIdPrefix: 'id-doc', resourceType: 'auto' });

  const [firstName_enc, lastName_enc, idNumber_enc, phone_enc, whatsapp_enc, email_enc, street_enc] = await Promise.all([
    encryption.encrypt(data.firstName),
    encryption.encrypt(data.lastName),
    encryption.encrypt(data.idNumber),
    encryption.encrypt(data.phone),
    encryption.encrypt(data.whatsapp || null),
    encryption.encrypt(data.email),
    encryption.encrypt(data.address.street || null),
  ]);

  const [firstName_bidx, lastName_bidx, phone_bidx, email_bidx] = await Promise.all([
    blindIndex.computeBlindIndex(data.firstName),
    blindIndex.computeBlindIndex(data.lastName),
    blindIndex.computeBlindIndex(data.phone),
    blindIndex.computeBlindIndex(data.email),
  ]);

  const referenceCode = await generateReferenceCode(data.lastName, (candidate) =>
    Application.exists({ referenceCode: candidate }).then(Boolean)
  );

  const application = await Application.create({
    firstName_enc,
    firstName_bidx,
    lastName_enc,
    lastName_bidx,
    idType: data.idType,
    idNumber_enc,
    phone_enc,
    phone_bidx,
    whatsapp_enc,
    email_enc,
    email_bidx,
    address: {
      street_enc,
      suburb: data.address.suburb || null,
      city: data.address.city || null,
      province: data.address.province || null,
      postalCode: data.address.postalCode || null,
    },
    coursesSelected: data.coursesSelected,
    preferredIntake: data.preferredIntake,
    idDocumentUrl: uploadResult.public_id, // store the Cloudinary public_id, not a raw URL — signed on demand
    idDocumentResourceType: uploadResult.resource_type, // needed later to build a valid private_download_url (see model comment)
    // consentGiven is already guaranteed === true by Joi (submitApplication schema),
    // this call would never be reached otherwise. consentGivenAt is server-set
    // (request time), never trusted from the client — makes the timestamp
    // provable rather than spoofable.
    consentGiven: true,
    consentGivenAt: new Date(),
    referenceCode,
    status: APPLICATION_STATUS.NEW,
    totalAmount,
    statusHistory: [{ status: APPLICATION_STATUS.NEW, changedBy: null, date: new Date() }],
  });

  await logAudit({
    action: 'application.created',
    targetType: 'Application',
    targetId: application._id,
    metadata: { referenceCode }, // reference code is plaintext/non-PII — safe to log
  });

  return { application, applicantEmail: data.email, applicantName: `${data.firstName} ${data.lastName}` };
}

async function listApplications({ status, courseId, intakeId, from, to, page = 1, limit = 20 }) {
  const filter = {};
  if (status) filter.status = status;
  if (courseId) filter.coursesSelected = courseId;
  if (intakeId) filter.preferredIntake = intakeId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('coursesSelected', 'grade title fee')
      .populate('preferredIntake', 'title startDate'),
    Application.countDocuments(filter),
  ]);

  const items = await Promise.all(docs.map(toDecryptedJSON));
  return { items, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

async function getApplicationById(id) {
  const doc = await Application.findById(id)
    .populate('coursesSelected', 'grade title fee')
    .populate('preferredIntake', 'title startDate')
    .populate('statusHistory.changedBy', 'name');
  if (!doc) throw ApiError.notFound('Application not found');
  return toDecryptedJSON(doc);
}

/**
 * FR-APP-08/FR-APP-09/FR-APP-10/FR-APP-12: status transition state machine.
 * PDF/email side effects for payment_verified are wired in by
 * applicationWorkflow.service.js in Phase 3, which calls this function first
 * and then triggers the invoice/email flow — kept separate so this function
 * stays a pure state-machine operation, testable in isolation.
 */
async function updateApplicationStatus(id, newStatus, actorId) {
  const application = await Application.findById(id);
  if (!application) throw ApiError.notFound('Application not found');

  const allowedNext = APPLICATION_STATUS_TRANSITIONS[application.status] || [];
  if (!allowedNext.includes(newStatus)) {
    throw ApiError.conflict(`Cannot transition from '${application.status}' to '${newStatus}'`);
  }

  application.status = newStatus;
  application.statusHistory.push({ status: newStatus, changedBy: actorId, date: new Date() });
  await application.save();

  await logAudit({
    actor: actorId,
    action: 'application.status_changed',
    targetType: 'Application',
    targetId: id,
    metadata: { newStatus, referenceCode: application.referenceCode },
  });

  return application;
}

async function hasApplicationsForIntake(intakeId) {
  return Application.exists({ preferredIntake: intakeId }).then(Boolean);
}

async function getSignedDocumentUrl(id) {
  const application = await Application.findById(id);
  if (!application) throw ApiError.notFound('Application not found');
  return getSignedUrl(application.idDocumentUrl, {
    expiresInSeconds: 300,
    resourceType: application.idDocumentResourceType,
  });
}

module.exports = {
  submitApplication,
  listApplications,
  getApplicationById,
  updateApplicationStatus,
  getSignedDocumentUrl,
  hasApplicationsForIntake,
  toDecryptedJSON,
  computeTotalAmount,
};
