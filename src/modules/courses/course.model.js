'use strict';

const mongoose = require('mongoose');
const { COURSE_GRADE } = require('../../shared/constants/enums');

const courseSchema = new mongoose.Schema(
  {
    grade: { type: String, enum: Object.values(COURSE_GRADE), required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    duration: { type: String, required: true }, // e.g. "1 Week" — kept as display string per scope doc
    fee: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    // Maximum students per intake run. null = unlimited.
    // Used as the default when computing capacity alerts for intakes that
    // have no intake-level capacity override.
    capacity: { type: Number, default: null, min: 1 },
  },
  {
    timestamps: true,
    // Mongoose 8 does not include the `id` virtual in toJSON output unless
    // virtuals: true is set. Without this, course.id is undefined on the
    // frontend, causing all courses to share the same undefined id — which
    // makes clicking one checkbox appear to select/deselect all of them, and
    // causes coursesSelected to submit as [null] which fails Joi validation.
    toJSON: { virtuals: true },
  }
);

module.exports = mongoose.model('Course', courseSchema);
