'use strict';

const Announcement = require('./announcement.model');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

// Every other module (users, applications) shapes its output with `id`
// instead of relying on Mongoose's raw document serialization, which only
// includes `_id` unless the schema opts into `toJSON: { virtuals: true }`
// (announcement.model.js doesn't). Without this, every announcement the
// frontend receives has `id: undefined` — AnnouncementList's row keys and,
// critically, the delete button's `deleting.id` — so delete was sending
// DELETE /admin/announcements/undefined, which fails the :id ObjectId
// validation before it ever reaches the service.
function toJSON(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    title: obj.title,
    body: obj.body,
    isActive: obj.isActive,
    publishAt: obj.publishAt,
    expiresAt: obj.expiresAt,
    createdAt: obj.createdAt,
  };
}

async function listPublicAnnouncements() {
  const now = new Date();
  const docs = await Announcement.find({
    isActive: true,
    $and: [
      { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
    ],
  }).sort({ publishAt: -1, createdAt: -1 });
  return docs.map(toJSON);
}

// Was missing — Frontend TAD §14 gap #2. The admin panel's announcements page
// needs to manage scheduled-future and expired items too, not just what the
// public site currently shows; the public query above deliberately filters
// those out, so it can't double as the admin list.
async function listAllAnnouncementsAdmin() {
  const docs = await Announcement.find().sort({ publishAt: -1, createdAt: -1 });
  return docs.map(toJSON);
}

// Was missing.
async function getAnnouncementById(id) {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return toJSON(announcement);
}

async function createAnnouncement(data, actorId) {
  const announcement = await Announcement.create(data);
  await logAudit({ actor: actorId, action: 'announcement.created', targetType: 'Announcement', targetId: announcement._id });
  return toJSON(announcement);
}

async function updateAnnouncement(id, updates, actorId) {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');

  Object.assign(announcement, updates);
  await announcement.save();

  await logAudit({ actor: actorId, action: 'announcement.updated', targetType: 'Announcement', targetId: id, metadata: { fields: Object.keys(updates) } });
  return toJSON(announcement);
}

// Was missing — PUT full replace: title/body required.
async function replaceAnnouncement(id, data, actorId) {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');

  announcement.title = data.title;
  announcement.body = data.body;
  announcement.publishAt = data.publishAt !== undefined ? data.publishAt : announcement.publishAt;
  announcement.expiresAt = data.expiresAt !== undefined ? data.expiresAt : announcement.expiresAt;
  if (data.isActive !== undefined) announcement.isActive = data.isActive;
  await announcement.save();

  await logAudit({ actor: actorId, action: 'announcement.replaced', targetType: 'Announcement', targetId: id });
  return toJSON(announcement);
}

// Was missing.
async function deleteAnnouncement(id, actorId) {
  const announcement = await Announcement.findByIdAndDelete(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  await logAudit({ actor: actorId, action: 'announcement.deleted', targetType: 'Announcement', targetId: id });
}

module.exports = { listPublicAnnouncements, listAllAnnouncementsAdmin, getAnnouncementById, createAnnouncement, updateAnnouncement, replaceAnnouncement, deleteAnnouncement };
