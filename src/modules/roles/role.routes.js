'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const roleValidation = require('./role.validation');
const roleController = require('./role.controller');

const router = express.Router();

router.use(authenticate, can('users:manage'));

router.get('/', roleController.list);
router.get('/:id', validate(roleValidation.paramsId, 'params'), roleController.getById);
router.post('/', validate(roleValidation.createRole), roleController.create);
router.patch(
  '/:id',
  validate(roleValidation.paramsId, 'params'),
  validate(roleValidation.updateRolePermissions),
  roleController.updatePermissions
);

module.exports = router;
