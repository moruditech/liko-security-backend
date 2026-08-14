'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const courseService = require('./course.service');

const listPublicCourses = asyncHandler(async (req, res) => {
  const courses = await courseService.listActiveCourses();
  new ApiResponse(courses, 'Active courses retrieved').send(res, 200);
});

const listAllCourses = asyncHandler(async (req, res) => {
  const courses = await courseService.listAllCourses();
  new ApiResponse(courses, 'All courses retrieved').send(res, 200);
});

// Was missing — admin panel needs to fetch a single course to edit it.
const getCourseById = asyncHandler(async (req, res) => {
  const course = await courseService.getCourseById(req.params.id);
  new ApiResponse(course, 'Course retrieved').send(res, 200);
});

const createCourse = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(req.body, req.user.id);
  new ApiResponse(course, 'Course created').send(res, 201);
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(req.params.id, req.body, req.user.id);
  new ApiResponse(course, 'Course updated').send(res, 200);
});

const listPublicIntakes = asyncHandler(async (req, res) => {
  const intakes = await courseService.listUpcomingActiveIntakes();
  new ApiResponse(intakes, 'Upcoming intakes retrieved').send(res, 200);
});

// Was missing — no way for admins to see past/inactive intakes at all.
const listAllIntakesAdmin = asyncHandler(async (req, res) => {
  const intakes = await courseService.listAllIntakesAdmin();
  new ApiResponse(intakes, 'All intakes retrieved').send(res, 200);
});

// Was missing.
const getIntakeById = asyncHandler(async (req, res) => {
  const intake = await courseService.getIntakeById(req.params.id);
  new ApiResponse(intake, 'Intake retrieved').send(res, 200);
});

const createIntake = asyncHandler(async (req, res) => {
  const intake = await courseService.createIntake(req.body, req.user.id);
  new ApiResponse(intake, 'Intake created').send(res, 201);
});

// Was missing — the biggest gap found: admins previously could create an
// intake but never fix a wrong date or update applicable grades afterward.
const updateIntake = asyncHandler(async (req, res) => {
  const intake = await courseService.updateIntake(req.params.id, req.body, req.user.id);
  new ApiResponse(intake, 'Intake updated').send(res, 200);
});

// Was missing.
const deleteIntake = asyncHandler(async (req, res) => {
  await courseService.deleteIntake(req.params.id, req.user.id);
  res.status(204).send();
});

module.exports = {
  listPublicCourses,
  listAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  listPublicIntakes,
  listAllIntakesAdmin,
  getIntakeById,
  createIntake,
  updateIntake,
  deleteIntake,
};
