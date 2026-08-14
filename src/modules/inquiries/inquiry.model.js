'use strict';

const mongoose = require('mongoose');
const { INQUIRY_STATUS } = require('../../shared/constants/enums');

const inquirySchema = new mongoose.Schema(
  {
    name_enc: { type: String, required: true },
    name_bidx: { type: String, required: true, index: true },

    email_enc: { type: String, required: true },
    email_bidx: { type: String, required: true, index: true },

    phone_enc: { type: String, default: null },

    message: { type: String, required: true, trim: true, maxlength: 5000 },

    status: { type: String, enum: Object.values(INQUIRY_STATUS), default: INQUIRY_STATUS.OPEN },

    replies: [
      {
        message: { type: String, required: true },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

inquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Inquiry', inquirySchema);
