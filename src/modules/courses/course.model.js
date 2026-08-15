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
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
