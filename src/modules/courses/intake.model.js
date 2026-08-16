'use strict';

const mongoose = require('mongoose');
const { COURSE_GRADE } = require('../../shared/constants/enums');

const intakeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    applicableGrades: {
      type: [String],
      enum: Object.values(COURSE_GRADE),
      required: true,
      validate: { validator: (arr) => arr.length > 0, message: 'At least one applicable grade is required' },
    },
    isActive: { type: Boolean, default: true },
    // Per-intake capacity override. If set, takes precedence over the sum
    // of course.capacity values for applicable grades. null = use course default.
    capacity: { type: Number, default: null, min: 1 },
  },
  {
    timestamps: true,
    // Same Mongoose 8 issue as course.model.js — intake.id is used as the
    // <option value> in IntakeSelector; without this it would be undefined,
    // causing preferredIntake to submit as empty and fail validation.
    toJSON: { virtuals: true },
  }
);

/**
 * FR-CRS-02: "past intakes are auto-flagged inactive". Rather than relying on a
 * cron job (out of scope for this deployment target), we lazily auto-flag on
 * every read path that matters (service layer calls this before listing/public
 * queries) — cheap, idempotent, and doesn't require infrastructure the client
 * hasn't budgeted for.
 */
intakeSchema.statics.autoFlagPastIntakes = async function autoFlagPastIntakes() {
  await this.updateMany({ startDate: { $lt: new Date() }, isActive: true }, { $set: { isActive: false } });
};

module.exports = mongoose.model('Intake', intakeSchema);
