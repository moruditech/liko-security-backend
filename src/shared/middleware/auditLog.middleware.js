'use strict';

const { logAudit } = require('../../modules/auditLogs/auditLog.service');

/**
 * Route-specific middleware that logs a mutation AFTER the controller succeeds
 * (i.e. mounted so it runs post-controller, or invoked directly at the end of a
 * service/controller for actions needing the created/updated resource's ID).
 *
 * Two usage patterns supported across the codebase:
 *
 * 1. Declarative, for simple fixed-action routes:
 *      router.patch('/:id/deactivate', authenticate, can('users:manage'),
 *        controller.deactivate, auditAction('user.deactivated', 'User'))
 *
 * 2. Direct call from inside a service, when the action name or target depends
 *    on runtime values (e.g. which status an application transitioned to) —
 *    services call auditLogService.logAudit(...) directly in that case instead.
 *
 * This middleware reads req.auditTarget (set by the controller before calling next())
 * to know which resource ID to attach, keeping the middleware itself generic.
 */
function auditAction(action, targetType) {
  return async function auditActionMiddleware(req, res, next) {
    await logAudit({
      actor: req.user ? req.user.id : null,
      action,
      targetType,
      targetId: req.auditTarget || req.params.id || null,
      metadata: req.auditMetadata || {},
      ipAddress: req.ip,
    });
    next();
  };
}

module.exports = { auditAction };
