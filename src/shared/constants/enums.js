'use strict';

/**
 * Single source of truth for enum-like values referenced across modules.
 * SRS explicitly forbids introducing new statuses/permissions without flagging it —
 * centralizing here makes any drift a one-file diff to review.
 */

const APPLICATION_STATUS = Object.freeze({
  NEW: 'new',
  UNDER_REVIEW: 'under_review',
  PAYMENT_VERIFIED: 'payment_verified',
  ENROLLED: 'enrolled',
  REJECTED: 'rejected',
});

// FR-APP-08: valid transitions only. 'rejected' reachable from any pre-enrolled stage.
const APPLICATION_STATUS_TRANSITIONS = Object.freeze({
  [APPLICATION_STATUS.NEW]: [APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.REJECTED],
  [APPLICATION_STATUS.UNDER_REVIEW]: [APPLICATION_STATUS.PAYMENT_VERIFIED, APPLICATION_STATUS.REJECTED],
  [APPLICATION_STATUS.PAYMENT_VERIFIED]: [APPLICATION_STATUS.ENROLLED, APPLICATION_STATUS.REJECTED],
  [APPLICATION_STATUS.ENROLLED]: [], // terminal
  [APPLICATION_STATUS.REJECTED]: [], // terminal
});

const ID_TYPE = Object.freeze({
  SA_ID: 'sa_id',
  PASSPORT: 'passport',
});

const COURSE_GRADE = Object.freeze({
  E: 'E',
  D: 'D',
  C: 'C',
  B: 'B',
});

const INVOICE_TYPE = Object.freeze({
  PROFORMA: 'proforma',
  OFFICIAL: 'official',
});

const INQUIRY_STATUS = Object.freeze({
  OPEN: 'open',
  REPLIED: 'replied',
});

const NOTIFICATION_METHOD = Object.freeze({
  EMAIL: 'email',
});

// Fixed permission enum (FR-USR-03: role permissions selected from this list, never free text)
const PERMISSIONS = Object.freeze([
  'applications:read',
  'applications:write',
  'invoices:issue',
  'courses:manage',
  'gallery:manage',
  'testimonials:manage',
  'faqs:manage',
  'inquiries:manage',
  'content:manage',
  'users:manage',
]);

const SYSTEM_ROLES = Object.freeze({
  SUPER_ADMIN: 'Super Admin',
  REGISTRAR: 'Registrar',
  FINANCE: 'Finance',
  CONTENT_EDITOR: 'Content Editor',
});

const SYSTEM_ROLE_PERMISSIONS = Object.freeze({
  [SYSTEM_ROLES.SUPER_ADMIN]: [...PERMISSIONS],
  [SYSTEM_ROLES.REGISTRAR]: ['applications:read', 'applications:write', 'courses:manage'],
  [SYSTEM_ROLES.FINANCE]: ['applications:read', 'invoices:issue'],
  [SYSTEM_ROLES.CONTENT_EDITOR]: ['gallery:manage', 'testimonials:manage', 'faqs:manage', 'content:manage'],
});

const GALLERY_CATEGORIES = Object.freeze(['Practical Drills', 'Graduations', 'Campus Life']);

module.exports = {
  APPLICATION_STATUS,
  APPLICATION_STATUS_TRANSITIONS,
  ID_TYPE,
  COURSE_GRADE,
  INVOICE_TYPE,
  INQUIRY_STATUS,
  NOTIFICATION_METHOD,
  PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_PERMISSIONS,
  GALLERY_CATEGORIES,
};
