'use strict';

const cloudinary = require('cloudinary').v2;
const env = require('./env');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = {
  cloudinary,
  PRIVATE_FOLDER: env.CLOUDINARY_PRIVATE_FOLDER, // ID documents — never public (TAD §14)
  PUBLIC_FOLDER: env.CLOUDINARY_PUBLIC_FOLDER, // gallery/testimonial/invoice-facing assets
};
