'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const courseValidation = require('./course.validation');
const courseController = require('./course.controller');

// GET /courses — public, active only
const publicCourseRouter = express.Router();
publicCourseRouter.get('/', courseController.listPublicCourses);

// /admin/courses — courses:manage
const adminCourseRouter = express.Router();
adminCourseRouter.use(authenticate, can('courses:manage'));
adminCourseRouter.get('/', courseController.listAllCourses);
adminCourseRouter.get('/:id', validate(courseValidation.paramsId, 'params'), courseController.getCourseById); // was missing
adminCourseRouter.post('/', validate(courseValidation.createCourse), courseController.createCourse);
adminCourseRouter.patch(
  '/:id',
  validate(courseValidation.paramsId, 'params'),
  validate(courseValidation.updateCourse),
  courseController.updateCourse
);

// GET /intakes — public, upcoming + active only
const publicIntakeRouter = express.Router();
publicIntakeRouter.get('/', courseController.listPublicIntakes);

// /admin/intakes — courses:manage
const adminIntakeRouter = express.Router();
adminIntakeRouter.use(authenticate, can('courses:manage'));
adminIntakeRouter.get('/', courseController.listAllIntakesAdmin); // was missing
adminIntakeRouter.get('/:id', validate(courseValidation.paramsId, 'params'), courseController.getIntakeById); // was missing
adminIntakeRouter.post('/', validate(courseValidation.createIntake), courseController.createIntake);
adminIntakeRouter.patch(
  '/:id',
  validate(courseValidation.paramsId, 'params'),
  validate(courseValidation.updateIntake),
  courseController.updateIntake
); // was missing — FR-CRS-02 "manage intake dates" had no edit path at all before this
adminIntakeRouter.delete('/:id', validate(courseValidation.paramsId, 'params'), courseController.deleteIntake); // was missing

module.exports = { publicCourseRouter, adminCourseRouter, publicIntakeRouter, adminIntakeRouter };
