'use strict';

const GalleryItem = require('./gallery.model');
const { uploadBuffer } = require('../../shared/utils/cloudinaryUpload');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');

async function listPublicItems(category) {
  const filter = { isActive: true };
  if (category) filter.category = category;
  return GalleryItem.find(filter).sort({ category: 1, order: 1 });
}

// Was missing — admin panel had no way to see deactivated gallery items.
async function listAllItemsAdmin(category) {
  const filter = {};
  if (category) filter.category = category;
  return GalleryItem.find(filter).sort({ category: 1, order: 1 });
}

// Was missing.
async function getItemById(id) {
  const item = await GalleryItem.findById(id);
  if (!item) throw ApiError.notFound('Gallery item not found');
  return item;
}

async function createItem({ title, category, mediaType }, file, actorId) {
  if (!file) throw ApiError.badRequest('Media file is required');

  const resourceType = mediaType === 'video' ? 'video' : 'image';
  const result = await uploadBuffer(file.buffer, { private: false, publicIdPrefix: 'gallery', resourceType });

  const item = await GalleryItem.create({
    title: title || '',
    category,
    mediaType,
    mediaUrl: result.secure_url,
  });

  await logAudit({ actor: actorId, action: 'gallery.item_created', targetType: 'GalleryItem', targetId: item._id });
  return item;
}

// Was missing — PUT semantics: title/category/mediaType required; media file
// optional (swapped in if provided, existing mediaUrl kept otherwise).
async function updateItem(id, { title, category, mediaType, isActive }, file, actorId) {
  const item = await GalleryItem.findById(id);
  if (!item) throw ApiError.notFound('Gallery item not found');

  item.title = title !== undefined ? title : item.title;
  item.category = category || item.category;
  item.mediaType = mediaType || item.mediaType;
  if (isActive !== undefined) item.isActive = isActive;

  if (file) {
    const resourceType = (mediaType || item.mediaType) === 'video' ? 'video' : 'image';
    const result = await uploadBuffer(file.buffer, { private: false, publicIdPrefix: 'gallery', resourceType });
    item.mediaUrl = result.secure_url;
  }

  await item.save();
  await logAudit({ actor: actorId, action: 'gallery.item_updated', targetType: 'GalleryItem', targetId: id });
  return item;
}

async function reorderItem(id, order, actorId) {
  const item = await GalleryItem.findById(id);
  if (!item) throw ApiError.notFound('Gallery item not found');

  item.order = order;
  await item.save();

  await logAudit({ actor: actorId, action: 'gallery.item_reordered', targetType: 'GalleryItem', targetId: id, metadata: { order } });
  return item;
}

async function deleteItem(id, actorId) {
  const item = await GalleryItem.findByIdAndDelete(id);
  if (!item) throw ApiError.notFound('Gallery item not found');
  await logAudit({ actor: actorId, action: 'gallery.item_deleted', targetType: 'GalleryItem', targetId: id });
}

module.exports = { listPublicItems, listAllItemsAdmin, getItemById, createItem, updateItem, reorderItem, deleteItem };
