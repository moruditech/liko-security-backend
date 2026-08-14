'use strict';

const FAQ = require('./faq.model');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

async function listPublicFaqs() {
  return FAQ.find({ isActive: true }).sort({ order: 1 });
}

// Admin listing — includes inactive FAQs, since the admin panel needs to manage
// items before they're published (list-only route, was missing).
async function listAllFaqs() {
  return FAQ.find().sort({ order: 1 });
}

async function getFaqById(id) {
  const faq = await FAQ.findById(id);
  if (!faq) throw ApiError.notFound('FAQ not found');
  return faq;
}

async function createFaq(data, actorId) {
  const faq = await FAQ.create(data);
  await logAudit({ actor: actorId, action: 'faq.created', targetType: 'FAQ', targetId: faq._id });
  return faq;
}

// Full replace (PUT semantics) — question/answer both required, distinct from
// the partial PATCH below.
async function replaceFaq(id, data, actorId) {
  const faq = await FAQ.findById(id);
  if (!faq) throw ApiError.notFound('FAQ not found');

  faq.question = data.question;
  faq.answer = data.answer;
  if (data.isActive !== undefined) faq.isActive = data.isActive;
  if (data.order !== undefined) faq.order = data.order;
  await faq.save();

  await logAudit({ actor: actorId, action: 'faq.replaced', targetType: 'FAQ', targetId: id });
  return faq;
}

async function createFaq(data, actorId) {
  const faq = await FAQ.create(data);
  await logAudit({ actor: actorId, action: 'faq.created', targetType: 'FAQ', targetId: faq._id });
  return faq;
}

async function updateFaq(id, updates, actorId) {
  const faq = await FAQ.findById(id);
  if (!faq) throw ApiError.notFound('FAQ not found');

  Object.assign(faq, updates);
  await faq.save();

  await logAudit({ actor: actorId, action: 'faq.updated', targetType: 'FAQ', targetId: id, metadata: { fields: Object.keys(updates) } });
  return faq;
}

async function reorderFaq(id, order, actorId) {
  const faq = await FAQ.findById(id);
  if (!faq) throw ApiError.notFound('FAQ not found');

  faq.order = order;
  await faq.save();

  await logAudit({ actor: actorId, action: 'faq.reordered', targetType: 'FAQ', targetId: id, metadata: { order } });
  return faq;
}

async function deleteFaq(id, actorId) {
  const faq = await FAQ.findByIdAndDelete(id);
  if (!faq) throw ApiError.notFound('FAQ not found');
  await logAudit({ actor: actorId, action: 'faq.deleted', targetType: 'FAQ', targetId: id });
}

module.exports = { listPublicFaqs, listAllFaqs, getFaqById, createFaq, updateFaq, replaceFaq, reorderFaq, deleteFaq };
