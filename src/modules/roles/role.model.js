'use strict';

const mongoose = require('mongoose');
const { PERMISSIONS } = require('../../shared/constants/enums');

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    permissions: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => arr.every((p) => PERMISSIONS.includes(p)),
        message: 'permissions must be selected from the fixed permission enum', // FR-USR-03
      },
      default: [],
    },
    isSystemRole: { type: Boolean, default: false }, // FR-USR-04 — protected from deletion
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
