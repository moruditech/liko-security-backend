'use strict';

const Testimonial = require('./testimonial.model');
const { uploadBuffer } = require('../../shared/utils/cloudinaryUpload');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

async function listPublicTestimonials() {
  // FR-CMS-02: featured testimonials returned first
  return Testimonial.find().sort({ isFeatured: -1, order: 1, createdAt: -1 });
}

async function getTestimonialById(id) {
  const testimonial = await Testimonial.findById(id);
  if (!testimonial) throw ApiError.notFound('Testimonial not found');
  return testimonial;
}

async function createTestimonial(data, file, actorId) {
  let photoUrl = null;
  if (file) {
    const result = await uploadBuffer(file.buffer, { private: false, publicIdPrefix: 'testimonial', resourceType: 'image' });
    photoUrl = result.secure_url;
  }

  const testimonial = await Testimonial.create({ ...data, photoUrl });
  await logAudit({ actor: actorId, action: 'testimonial.created', targetType: 'Testimonial', targetId: testimonial._id });
  return testimonial;
}

// PUT semantics — studentName/courseGrade/quote all required (full replace).
// Photo is optional on replace: if a new file is provided it's swapped in,
// otherwise the existing photoUrl is left untouched.
async function replaceTestimonial(id, data, file, actorId) {
  const testimonial = await Testimonial.findById(id);
  if (!testimonial) throw ApiError.notFound('Testimonial not found');

  testimonial.studentName = data.studentName;
  testimonial.courseGrade = data.courseGrade;
  testimonial.quote = data.quote;
  testimonial.isFeatured = data.isFeatured !== undefined ? data.isFeatured : testimonial.isFeatured;

  if (file) {
    const result = await uploadBuffer(file.buffer, { private: false, publicIdPrefix: 'testimonial', resourceType: 'image' });
    testimonial.photoUrl = result.secure_url;
  }

  await testimonial.save();
  await logAudit({ actor: actorId, action: 'testimonial.replaced', targetType: 'Testimonial', targetId: id });
  return testimonial;
}

async function createTestimonial(data, file, actorId) {
  let photoUrl = null;
  if (file) {
    const result = await uploadBuffer(file.buffer, { private: false, publicIdPrefix: 'testimonial', resourceType: 'image' });
    photoUrl = result.secure_url;
  }

  const testimonial = await Testimonial.create({ ...data, photoUrl });
  await logAudit({ actor: actorId, action: 'testimonial.created', targetType: 'Testimonial', targetId: testimonial._id });
  return testimonial;
}

async function updateTestimonial(id, updates, actorId) {
  const testimonial = await Testimonial.findById(id);
  if (!testimonial) throw ApiError.notFound('Testimonial not found');

  Object.assign(testimonial, updates);
  await testimonial.save();

  await logAudit({ actor: actorId, action: 'testimonial.updated', targetType: 'Testimonial', targetId: id, metadata: { fields: Object.keys(updates) } });
  return testimonial;
}

async function deleteTestimonial(id, actorId) {
  const testimonial = await Testimonial.findByIdAndDelete(id);
  if (!testimonial) throw ApiError.notFound('Testimonial not found');
  await logAudit({ actor: actorId, action: 'testimonial.deleted', targetType: 'Testimonial', targetId: id });
}

module.exports = { listPublicTestimonials, getTestimonialById, createTestimonial, updateTestimonial, replaceTestimonial, deleteTestimonial };
