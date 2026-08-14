'use strict';

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    publishAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
