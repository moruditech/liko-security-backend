'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const profileValidation = require('./profile.validation');
const profileController = require('./profile.controller');

const router = express.Router();

// Deliberately no can('users:manage') gate anywhere on this router — every
// authenticated user manages their OWN profile regardless of role/permissions.
// Contrast with users.routes.js, which is admin-only and acts on a :id param.
router.use(authenticate);

router.get('/', profileController.getProfile);
router.patch('/', validate(profileValidation.updateProfile), profileController.updateProfile);
router.patch('/password', validate(profileValidation.changePassword), profileController.changePassword);

module.exports = router;
