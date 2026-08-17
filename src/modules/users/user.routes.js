'use strict';

const express = require('express');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const userValidation = require('./user.validation');
const userController = require('./user.controller');

const router = express.Router();

router.use(authenticate, can('users:manage'));

router.get('/', userController.list);
router.get('/:id', validate(userValidation.paramsId, 'params'), userController.getById);
router.post('/', validate(userValidation.createUser), userController.create);
router.patch('/:id', validate(userValidation.paramsId, 'params'), validate(userValidation.updateUser), userController.update);
router.patch('/:id/deactivate', validate(userValidation.paramsId, 'params'), userController.deactivate);
router.patch('/:id/reactivate', validate(userValidation.paramsId, 'params'), userController.reactivate);

module.exports = router;
