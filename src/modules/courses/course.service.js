'use strict';

const Course = require('./course.model');
const Intake = require('./intake.model');
const applicationService = require('../applications/application.service');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

// --- Courses ---

async function listActiveCourses() {
  return Course.find({ isActive: true }).sort({ grade: 1 });
}

async function listAllCourses() {
  return Course.find().sort({ grade: 1 });
}

async function createCourse(data, actorId) {
  const course = await Course.create(data);
  await logAudit({ actor: actorId, action: 'course.created', targetType: 'Course', targetId: course._id });
  return course;
}

async function updateCourse(id, updates, actorId) {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found');

  Object.assign(course, updates);
  await course.save();

  await logAudit({ actor: actorId, action: 'course.updated', targetType: 'Course', targetId: id, metadata: { fields: Object.keys(updates) } });
  return course;
}

async function getCourseById(id) {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}

// --- Intakes ---

async function listUpcomingActiveIntakes() {
  await Intake.autoFlagPastIntakes(); // FR-CRS-02
  return Intake.find({ isActive: true, startDate: { $gte: new Date() } }).sort({ startDate: 1 });
}

// Admin listing — ALL intakes incl. past/inactive ones. Was entirely missing;
// without this, admins had no way to see (let alone edit) an intake once it
// dropped off the public "upcoming" list.
async function listAllIntakesAdmin() {
  await Intake.autoFlagPastIntakes();
  return Intake.find().sort({ startDate: -1 });
}

async function getIntakeById(id) {
  const intake = await Intake.findById(id);
  if (!intake) throw ApiError.notFound('Intake not found');
  return intake;
}

async function createIntake(data, actorId) {
  const intake = await Intake.create(data);
  await logAudit({ actor: actorId, action: 'intake.created', targetType: 'Intake', targetId: intake._id });
  return intake;
}

// Was entirely missing — admins previously had no way to fix a wrong date or
// change applicable grades on an existing intake (FR-CRS-02: "manage intake dates").
async function updateIntake(id, updates, actorId) {
  const intake = await Intake.findById(id);
  if (!intake) throw ApiError.notFound('Intake not found');

  Object.assign(intake, updates);
  await intake.save();

  await logAudit({ actor: actorId, action: 'intake.updated', targetType: 'Intake', targetId: id, metadata: { fields: Object.keys(updates) } });
  return intake;
}

// Was entirely missing — no way to remove an intake created in error.
// Blocks hard-delete when applications already reference this intake. This is
// NOT because a dangling ref would crash anything — Mongoose .populate() just
// returns null for a deleted reference, and invoice.service.js already handles
// a null preferredIntake gracefully. It's a business-record integrity concern:
// an application tied to a real (possibly paid, possibly enrolled) intake
// should keep pointing at that intake, not silently go blank. Deactivate
// (isActive: false) is the correct action once an intake is in use; hard
// delete stays available only for intakes nobody has applied to yet.
async function deleteIntake(id, actorId) {
  // Talk to the applications module through its service layer, not its model
  // directly (NFR-MAINT-01: no cross-module direct model access).
  const inUse = await applicationService.hasApplicationsForIntake(id);
  if (inUse) {
    throw ApiError.conflict('Cannot delete an intake that already has applications linked to it — deactivate it instead');
  }

  const intake = await Intake.findByIdAndDelete(id);
  if (!intake) throw ApiError.notFound('Intake not found');
  await logAudit({ actor: actorId, action: 'intake.deleted', targetType: 'Intake', targetId: id });
}

module.exports = {
  listActiveCourses,
  listAllCourses,
  createCourse,
  updateCourse,
  getCourseById,
  listUpcomingActiveIntakes,
  listAllIntakesAdmin,
  getIntakeById,
  createIntake,
  updateIntake,
  deleteIntake,
};
