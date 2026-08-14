'use strict';

const { cloudinary, PRIVATE_FOLDER, PUBLIC_FOLDER } = require('../../config/cloudinary');

/**
 * Streams a buffer (already magic-byte validated by upload.middleware.js) to
 * Cloudinary. EXIF stripped via Cloudinary's own transformation flag (TAD §14).
 *
 * @param {Buffer} buffer
 * @param {object} options
 * @param {boolean} options.private - true for ID documents (private folder, authenticated delivery)
 * @param {string} [options.publicIdPrefix] - optional prefix for the generated public_id
 * @param {string} [options.resourceType] - 'image' | 'raw' | 'auto' (PDFs use 'auto' or 'raw')
 */
function uploadBuffer(buffer, { private: isPrivate = false, publicIdPrefix = '', resourceType = 'auto' } = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: isPrivate ? PRIVATE_FOLDER : PUBLIC_FOLDER,
      resource_type: resourceType,
      type: isPrivate ? 'authenticated' : 'upload', // 'authenticated' delivery requires a signed URL
      public_id: publicIdPrefix ? `${publicIdPrefix}-${Date.now()}` : undefined,
      // Strip EXIF/metadata on upload (TAD §14)
      exif: false,
      image_metadata: false,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Generates a short-lived signed URL for a private (type: authenticated) asset.
 * Used for ID document delivery (FR-APP-11) — never a permanent public link.
 *
 * @param {string} publicId
 * @param {object} [options]
 * @param {number} [options.expiresInSeconds=300] - 5 minutes default
 */
function getSignedUrl(publicId, { expiresInSeconds = 300, resourceType = 'auto' } = {}) {
  const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url(publicId, undefined, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: timestamp,
  });
}

module.exports = { uploadBuffer, getSignedUrl };
