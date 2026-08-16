'use strict';

const AuditLog = require('./auditLog.model');

// listAuditLogs was returning raw Mongoose documents: only `_id` (not `id`),
// and `actor` as either null or, after .populate('actor', 'name'), a
// {_id, name} object — AuditLogTable renders `entry.actor` directly as a
// table cell, which crashes on any row with a real actor (React: "Objects
// are not valid as a React child"). Also renamed timestamp -> createdAt to
// match the frontend's AuditLogEntry type (this schema has
// { timestamps: false } and uses its own explicit `timestamp` field).
function toJSON(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    actor: obj.actor && typeof obj.actor === 'object' ? { id: obj.actor._id.toString(), name: obj.actor.name } : null,
    action: obj.action,
    targetType: obj.targetType,
    targetId: obj.targetId,
    createdAt: obj.timestamp,
  };
}

/**
 * The single write path for audit entries. Deliberately fire-and-forget-safe:
 * a logging failure must never take down the primary request (e.g. an admin
 * status change should still succeed even if, hypothetically, the audit write
 * hiccups) — but we DO surface the failure to server logs loudly, since a
 * silent audit gap is itself a security-relevant event.
 *
 * metadata MUST NOT contain decrypted PII (FR-AUD-02) — callers are responsible
 * for only passing references (IDs, status values, action names), never raw
 * applicant data. This is enforced by convention/code review, not automatically
 * detectable here, so treat it as a hard rule when calling this function.
 */
async function logAudit({ actor = null, action, targetType = null, targetId = null, metadata = {}, ipAddress = null }) {
  try {
    await AuditLog.create({
      actor,
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      metadata,
      ipAddress,
      timestamp: new Date(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[audit] FAILED to write audit entry for action="${action}":`, err.message);
  }
}

/**
 * Read path for Super Admin audit log viewer (FR-AUD-03). Filterable by
 * actor, action, or date range. Read-only — no update/delete exposed.
 */
async function listAuditLogs({ actor, action, from, to, page = 1, limit = 50 }) {
  const filter = {};
  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).populate('actor', 'name'),
    AuditLog.countDocuments(filter),
  ]);

  return { items: items.map(toJSON), total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

module.exports = { logAudit, listAuditLogs };
