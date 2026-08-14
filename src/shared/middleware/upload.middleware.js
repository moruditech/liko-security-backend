'use strict';

const multer = require('multer');
const { fromBuffer } = require('file-type');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Memory storage — files never touch disk; validated then streamed straight to Cloudinary.
const storage = multer.memoryStorage();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
// Default set — matches TAD §14's ID-document requirement (JPEG/PNG/PDF only).
// Callers needing a broader set (e.g. gallery video uploads) pass an explicit override.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const GALLERY_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm'];

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

/**
 * Multer field configs per route. Used as: uploadSingle('idDocument')
 */
function uploadSingle(fieldName) {
  return multerUpload.single(fieldName);
}

function uploadFields(fields) {
  return multerUpload.fields(fields);
}

/**
 * Content-based (magic-byte) file type validation — NOT extension or client-supplied
 * MIME header, both of which are trivially spoofable (TAD §14, FR-APP-03).
 * Runs AFTER multer has buffered the file, BEFORE the controller/service uploads
 * it to Cloudinary.
 *
 * @param {string|string[]} fieldNames - req.file field name, or array for req.files
 */
function validateFileContent(fieldNames, allowedMimeTypes = ALLOWED_MIME_TYPES) {
  const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

  return asyncHandler(async (req, res, next) => {
    const filesToCheck = [];

    if (req.file) {
      filesToCheck.push(req.file);
    }
    if (req.files) {
      for (const field of fields) {
        const arr = Array.isArray(req.files) ? req.files : req.files[field];
        if (arr) filesToCheck.push(...(Array.isArray(arr) ? arr : [arr]));
      }
    }

    for (const file of filesToCheck) {
      const detected = await fromBuffer(file.buffer);
      const detectedMime = detected ? detected.mime : null;

      if (!detectedMime || !allowedMimeTypes.includes(detectedMime)) {
        throw ApiError.badRequest(
          `File "${file.originalname}" failed content validation. Accepted types: ${allowedMimeTypes.join(', ')}.`
        );
      }

      // Attach the verified mime so downstream Cloudinary upload doesn't trust the client header.
      file.verifiedMime = detectedMime;
    }

    next();
  });
}

module.exports = {
  uploadSingle,
  uploadFields,
  validateFileContent,
  ALLOWED_MIME_TYPES,
  GALLERY_ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
};
