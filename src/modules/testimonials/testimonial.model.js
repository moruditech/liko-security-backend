'use strict';

const mongoose = require('mongoose');
const { COURSE_GRADE } = require('../../shared/constants/enums');

const testimonialSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true }, // plaintext — voluntarily published, distinct from applicant PII (TAD §7)
    courseGrade: { type: String, enum: Object.values(COURSE_GRADE), required: true },
    quote: { type: String, required: true, trim: true, maxlength: 2000 },
    photoUrl: { type: String, default: null }, // public Cloudinary URL
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Testimonial', testimonialSchema);
