'use strict';

const mongoose = require('mongoose');
const { GALLERY_CATEGORIES } = require('../../shared/constants/enums');

const galleryItemSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    mediaUrl: { type: String, required: true }, // public Cloudinary URL
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    category: { type: String, enum: GALLERY_CATEGORIES, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

galleryItemSchema.index({ category: 1, order: 1 });

module.exports = mongoose.model('GalleryItem', galleryItemSchema);
