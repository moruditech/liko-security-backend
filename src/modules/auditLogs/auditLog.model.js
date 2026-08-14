'use strict';

const mongoose = require('mongoose');

/**
 * Append-only audit trail (TAD §13, FR-AUD-01/02).
 * - No route anywhere in the app exposes PATCH/DELETE for this collection.
 * - The production DB user's grants should additionally exclude update/delete
 *   on this collection at the database-role level (TAD §11) — belt and braces:
 *   even a compromised admin session can't erase the record of having acted.
 * - metadata must NEVER contain decrypted PII — only references/context (FR-AUD-02).
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for unauthenticated actions (e.g. failed login attempts)
    action: { type: String, required: true }, // e.g. "application.status_changed"
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Defense in depth: block mutation/deletion at the application layer too, not just
// by omitting routes and DB-role grants. Any attempt to update or delete an audit
// entry via Mongoose throws immediately.
const BLOCKED_OPS = ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany', 'findOneAndRemove'];
for (const op of BLOCKED_OPS) {
  auditLogSchema.pre(op, function blockMutation(next) {
    next(new Error(`[auditLog] Append-only collection — ${op} is not permitted`));
  });
}

module.exports = mongoose.model('AuditLog', auditLogSchema);
