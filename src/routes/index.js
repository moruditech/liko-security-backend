'use strict';

const express = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const profileRoutes = require('../modules/profile/profile.routes');
const userRoutes = require('../modules/users/user.routes');
const roleRoutes = require('../modules/roles/role.routes');
const applicationRoutes = require('../modules/applications/application.routes');
const invoiceRoutes = require('../modules/invoices/invoice.routes');
const {
  publicCourseRouter,
  adminCourseRouter,
  publicIntakeRouter,
  adminIntakeRouter,
} = require('../modules/courses/course.routes');

const { publicRouter: publicGalleryRouter, adminRouter: adminGalleryRouter } = require('../modules/gallery/gallery.routes');
const { publicRouter: publicTestimonialRouter, adminRouter: adminTestimonialRouter } = require('../modules/testimonials/testimonial.routes');
const { publicRouter: publicFaqRouter, adminRouter: adminFaqRouter } = require('../modules/faqs/faq.routes');
const { publicRouter: publicInquiryRouter, adminRouter: adminInquiryRouter } = require('../modules/inquiries/inquiry.routes');
const { publicRouter: publicAnnouncementRouter, adminRouter: adminAnnouncementRouter } = require('../modules/announcements/announcement.routes');
const { publicRouter: publicSettingsRouter, adminRouter: adminSettingsRouter } = require('../modules/settings/settings.routes');
const auditLogRoutes = require('../modules/auditLogs/auditLog.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');

const router = express.Router();

router.get('/health', (req, res) => res.status(200).json({ success: true, data: { status: 'ok' }, message: 'Liko backend is running' }));

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/applications', applicationRoutes);
router.use('/courses', publicCourseRouter);
router.use('/admin/courses', adminCourseRouter);
router.use('/intakes', publicIntakeRouter);
router.use('/admin/intakes', adminIntakeRouter);
router.use('/invoices', invoiceRoutes);

router.use('/gallery', publicGalleryRouter);
router.use('/admin/gallery', adminGalleryRouter);
router.use('/testimonials', publicTestimonialRouter);
router.use('/admin/testimonials', adminTestimonialRouter);
router.use('/faqs', publicFaqRouter);
router.use('/admin/faqs', adminFaqRouter);
router.use('/inquiries', publicInquiryRouter);
router.use('/admin/inquiries', adminInquiryRouter);
router.use('/announcements', publicAnnouncementRouter);
router.use('/admin/announcements', adminAnnouncementRouter);
router.use('/settings', publicSettingsRouter);
router.use('/admin/settings', adminSettingsRouter);
router.use('/admin/audit-logs', auditLogRoutes);
router.use('/admin/analytics', analyticsRoutes);

module.exports = router;
