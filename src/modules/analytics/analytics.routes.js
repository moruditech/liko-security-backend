'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const analyticsController = require('./analytics.controller');

const router = express.Router();

router.use(authenticate, can('applications:read'));

// GET /admin/analytics?period=daily|weekly|monthly
router.get('/', analyticsController.dashboard);

// GET /admin/analytics/capacity
router.get('/capacity', analyticsController.capacityAlerts);

module.exports = router;
