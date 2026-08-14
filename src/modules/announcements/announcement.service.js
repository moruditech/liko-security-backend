'use strict';

const Announcement = require('./announcement.model');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

async function listPublicAnnouncements() {
  const now = new Date();
  return Announcement.find({
    isActive: true,
    $and: [
      { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
    ],
  }).sort({ publishAt: -1, createdAt: -1 });
}

// Was missing — Frontend TAD §14 gap #2. The admin panel's announcements page
// needs to manage scheduled-future and expired items too, not just what the
// public site currently shows; the public query above deliberately filters
// those out, so it can't double as the admin list.
async function listAllAnnouncementsAdmin() {
  return Announcement.find().sort({ publishAt: -1, createdAt: -1 });
}

// Was missing.
async function getAnnouncementById(id) {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

async function createAnnouncement(data, actorId) {
  const announcement = await Announcement.create(data);
  await logAudit({ actor: actorId, action: 'announcement.created', targetType: 'Announcement', targetId: announcement._id });
  return announcement;
}

async function updateAnnouncement(id, updates, actorId) {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');

  Object.assign(announcement, updates);
  await announcement.save();

  await logAudit({ actor: actorId, action: 'announcement.updated', targetType: 'Announcement', targetId: id, metadata: { fields: Object.keys(updates) } });
  return announcement;
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
  return announcement;
}

// Was missing.
async function deleteAnnouncement(id, actorId) {
  const announcement = await Announcement.findByIdAndDelete(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  await logAudit({ actor: actorId, action: 'announcement.deleted', targetType: 'Announcement', targetId: id });
}

module.exports = { listPublicAnnouncements, listAllAnnouncementsAdmin, getAnnouncementById, createAnnouncement, updateAnnouncement, replaceAnnouncement, deleteAnnouncement };
