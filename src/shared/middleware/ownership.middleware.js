'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../../modules/auditLogs/auditLog.service');

/**
 * BOLA/BOPLA prevention (TAD §9). Confirms the requesting user is actually
 * scoped to the SPECIFIC object being acted on, not just holding the permission
 * string in general. Applied on every object-level route (e.g. /applications/:id).
 *
 * Liko's current role model (Super Admin / Registrar / Finance / Content Editor)
 * is functionally scoped rather than owner-scoped — e.g. any Registrar may act on
 * any application, since there's no "my applications" concept in this business.
 * The check that matters here is therefore twofold, and this middleware enforces
 * both generically so individual route files don't reimplement it:
 *
 *   1. Existence — does the target object actually exist? (404 vs silently
 *      leaking a 403 that confirms existence to an unauthorized prober)
 *   2. Field-level write scope — for mutation routes, is the requester trying
 *      to change a field their role isn't allowed to touch directly?
 *      (e.g. FR-APP-12: Registrar cannot set totalAmount via the status route)
 *
 * @param {import('mongoose').Model} Model
 * @param {object} options
 * @param {string[]} [options.forbiddenFieldsByRole] - map of roleName -> fields that role
 *        may never set directly on this route, even if otherwise permitted
 * @param {string} [options.idParam] - route param holding the target's _id (default 'id')
 */
function checkOwnership(Model, options = {}) {
  const { forbiddenFieldsByRole = {}, idParam = 'id' } = options;

  return asyncHandler(async (req, res, next) => {
    const targetId = req.params[idParam];
    const doc = await Model.findById(targetId);

    if (!doc) {
      throw ApiError.notFound('Resource not found');
    }

    const roleForbiddenFields = forbiddenFieldsByRole[req.user.roleName] || [];
    const attemptedForbiddenField = roleForbiddenFields.find((field) => Object.prototype.hasOwnProperty.call(req.body, field));

    if (attemptedForbiddenField) {
      await logAudit({
        actor: req.user.id,
        action: 'ownership.field_scope_violation',
        targetType: Model.modelName,
        targetId,
        metadata: { field: attemptedForbiddenField, role: req.user.roleName },
        ipAddress: req.ip,
      });
      throw ApiError.forbidden(`Your role cannot modify '${attemptedForbiddenField}' directly`);
    }

    // Attach the loaded doc so controllers don't have to re-fetch it.
    req.targetDoc = doc;
    next();
  });
}

module.exports = { checkOwnership };
