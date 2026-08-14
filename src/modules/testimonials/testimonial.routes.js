'use strict';

const express = require('express');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const { uploadSingle, validateFileContent } = require('../../shared/middleware/upload.middleware');
const testimonialValidation = require('./testimonial.validation');
const testimonialService = require('./testimonial.service');

const listPublic = asyncHandler(async (req, res) => {
  const testimonials = await testimonialService.listPublicTestimonials();
  new ApiResponse(testimonials, 'Testimonials retrieved').send(res, 200);
});

// Admin single-item GET — was missing, needed for the admin panel's edit view.
const getById = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.getTestimonialById(req.params.id);
  new ApiResponse(testimonial, 'Testimonial retrieved').send(res, 200);
});

const create = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.createTestimonial(req.body, req.file, req.user.id);
  new ApiResponse(testimonial, 'Testimonial created').send(res, 201);
});

const update = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.updateTestimonial(req.params.id, req.body, req.user.id);
  new ApiResponse(testimonial, 'Testimonial updated').send(res, 200);
});

// PUT — full replace; photo is optional (swapped in if provided, kept otherwise).
const replace = asyncHandler(async (req, res) => {
  const testimonial = await testimonialService.replaceTestimonial(req.params.id, req.body, req.file, req.user.id);
  new ApiResponse(testimonial, 'Testimonial replaced').send(res, 200);
});

const remove = asyncHandler(async (req, res) => {
  await testimonialService.deleteTestimonial(req.params.id, req.user.id);
  res.status(204).send();
});

// GET /testimonials — public, featured-first (API spec B.6)
const publicRouter = express.Router();
publicRouter.get('/', listPublic);

// /admin/testimonials — testimonials:manage
const adminRouter = express.Router();
adminRouter.use(authenticate, can('testimonials:manage'));
adminRouter.get('/:id', validate(testimonialValidation.paramsId, 'params'), getById); // was missing
adminRouter.post('/', uploadSingle('photo'), validateFileContent('photo'), validate(testimonialValidation.createTestimonial), create);
adminRouter.put(
  '/:id',
  uploadSingle('photo'),
  validateFileContent('photo'),
  validate(testimonialValidation.paramsId, 'params'),
  validate(testimonialValidation.replaceTestimonial),
  replace
); // was missing
// PATCH/DELETE fill FR-CMS-02's "feature/delete" requirement — API spec table B.6 only
// lists POST for testimonials, which looks like a gap against the FR; flagging here.
adminRouter.patch('/:id', validate(testimonialValidation.paramsId, 'params'), validate(testimonialValidation.updateTestimonial), update);
adminRouter.delete('/:id', validate(testimonialValidation.paramsId, 'params'), remove);

module.exports = { publicRouter, adminRouter };
