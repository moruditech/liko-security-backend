'use strict';

const express = require('express');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const faqValidation = require('./faq.validation');
const faqService = require('./faq.service');

const listPublic = asyncHandler(async (req, res) => {
  const faqs = await faqService.listPublicFaqs();
  new ApiResponse(faqs, 'FAQs retrieved').send(res, 200);
});

// Admin listing — includes inactive FAQs (was missing; admin panel needs to
// see and manage unpublished items too).
const listAllAdmin = asyncHandler(async (req, res) => {
  const faqs = await faqService.listAllFaqs();
  new ApiResponse(faqs, 'FAQs retrieved').send(res, 200);
});

const getById = asyncHandler(async (req, res) => {
  const faq = await faqService.getFaqById(req.params.id);
  new ApiResponse(faq, 'FAQ retrieved').send(res, 200);
});

const create = asyncHandler(async (req, res) => {
  const faq = await faqService.createFaq(req.body, req.user.id);
  new ApiResponse(faq, 'FAQ created').send(res, 201);
});

const update = asyncHandler(async (req, res) => {
  const faq = await faqService.updateFaq(req.params.id, req.body, req.user.id);
  new ApiResponse(faq, 'FAQ updated').send(res, 200);
});

// PUT — full replace (question + answer required), distinct from the partial PATCH above.
const replace = asyncHandler(async (req, res) => {
  const faq = await faqService.replaceFaq(req.params.id, req.body, req.user.id);
  new ApiResponse(faq, 'FAQ replaced').send(res, 200);
});

const reorder = asyncHandler(async (req, res) => {
  const faq = await faqService.reorderFaq(req.params.id, req.body.order, req.user.id);
  new ApiResponse(faq, 'FAQ reordered').send(res, 200);
});

const remove = asyncHandler(async (req, res) => {
  await faqService.deleteFaq(req.params.id, req.user.id);
  res.status(204).send();
});

// GET /faqs — public, active + ordered
const publicRouter = express.Router();
publicRouter.get('/', listPublic);

// /admin/faqs — faqs:manage
const adminRouter = express.Router();
adminRouter.use(authenticate, can('faqs:manage'));
adminRouter.get('/', listAllAdmin); // was missing — admin panel needs full (incl. inactive) list
adminRouter.get('/:id', validate(faqValidation.paramsId, 'params'), getById); // was missing
adminRouter.post('/', validate(faqValidation.createFaq), create);
adminRouter.put('/:id', validate(faqValidation.paramsId, 'params'), validate(faqValidation.replaceFaq), replace); // was missing
adminRouter.patch('/:id', validate(faqValidation.paramsId, 'params'), validate(faqValidation.updateFaq), update);
adminRouter.patch('/:id/reorder', validate(faqValidation.paramsId, 'params'), validate(faqValidation.reorder), reorder);
// FR-CMS-03 says "add/edit/reorder/delete" — API spec B.6 table omits DELETE for FAQs; adding it to satisfy the FR.
adminRouter.delete('/:id', validate(faqValidation.paramsId, 'params'), remove);

module.exports = { publicRouter, adminRouter };
