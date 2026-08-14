'use strict';

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../../modules/auditLogs/auditLog.service');

/**
 * Permission-string based access control (TAD §9). Never checks role NAME —
 * only whether req.user.permissions includes the required string(s). New roles
 * with the right permissions work automatically, no route code changes needed.
 *
 * can('applications:read')                          -> requires exactly this permission
 * can(['invoices:issue', 'applications:write'], 'any') -> requires at least one
 * can(['invoices:issue', 'applications:write'], 'all') -> requires all
 */
function can(required, mode = 'any') {
  const requiredList = Array.isArray(required) ? required : [required];

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      // authenticate() must run before can() — programming error if this trips
      throw ApiError.internal('permission.middleware used without prior authentication');
    }

    const userPermissions = req.user.permissions || [];
    const hasAccess =
      mode === 'all'
        ? requiredList.every((p) => userPermissions.includes(p))
        : requiredList.some((p) => userPermissions.includes(p));

    if (!hasAccess) {
      // FR-AUD-01: permission-denied events are audit-logged
      await logAudit({
        actor: req.user.id,
        action: 'permission.denied',
        targetType: 'route',
        targetId: req.originalUrl,
        metadata: { required: requiredList, mode, method: req.method },
        ipAddress: req.ip,
      });
      throw ApiError.forbidden('You do not have permission to perform this action');
    }

    next();
  });
}

module.exports = { can };
