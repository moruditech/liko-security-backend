'use strict';

const mongoose = require('mongoose');

/**
 * Admin/staff user. Encryption of email_enc/email_bidx happens in the SERVICE
 * layer (via shared/security/encryption.js + blindIndex.js) before the model
 * is constructed/saved — NOT in a Mongoose hook — so the encryption dependency
 * stays explicit and testable rather than hidden in schema middleware.
 *
 * Never store plaintext email. Never log passwordHash or mfaSecret_enc.
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: null, trim: true }, // plain — internal staff contact, not applicant PII

    email_enc: { type: String, required: true }, // AES-256-GCM
    email_bidx: { type: String, required: true, unique: true, index: true }, // HMAC-SHA-256, searchable

    passwordHash: { type: String, required: true, select: false }, // bcrypt, cost >= 12 (NFR-SEC-03)

    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }, // FR-USR-02: cannot be null

    mfaEnabled: { type: Boolean, default: false },
    mfaSecret_enc: { type: String, default: null, select: false }, // TOTP secret, encrypted at rest

    isActive: { type: Boolean, default: true }, // FR-USR-01: deactivated users cannot log in
    lastLogin: { type: Date, default: null },

    // Server-side revocable refresh sessions (FR-AUTH-03/05) — store hashed tokens only, never raw
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Single-use, time-limited password reset (FR-AUTH-06)
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
