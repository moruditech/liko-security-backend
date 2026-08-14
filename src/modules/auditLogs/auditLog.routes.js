'use strict';

const express = require('express');
const Joi = require('joi');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { authenticate } = require('../../shared/middleware/auth.middleware');
const { can } = require('../../shared/middleware/permission.middleware');
const validate = require('../../shared/middleware/validate.middleware');
const auditLogService = require('./auditLog.service');

const listQuery = Joi.object({
  actor: Joi.string(),
  action: Joi.string(),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

const list = asyncHandler(async (req, res) => {
  const result = await auditLogService.listAuditLogs(req.query);
  new ApiResponse(result, 'Audit logs retrieved').send(res, 200);
});

// GET /admin/audit-logs — users:manage (Super Admin), read-only — no PATCH/DELETE route exists
// anywhere in this module, consistent with the append-only guarantee (FR-AUD-01, FR-AUD-03).
const router = express.Router();
router.get('/', authenticate, can('users:manage'), validate(listQuery, 'query'), list);

module.exports = router;
