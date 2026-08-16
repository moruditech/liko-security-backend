'use strict';

const Inquiry = require('./inquiry.model');
const encryption = require('../../shared/security/encryption');
const blindIndex = require('../../shared/security/blindIndex');
const { sendEmail } = require('../../shared/utils/mailer');
const ApiError = require('../../shared/utils/ApiError');
const { logAudit } = require('../auditLogs/auditLog.service');
const { INQUIRY_STATUS } = require('../../shared/constants/enums');

async function toDecryptedJSON(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const [name, email, phone] = await Promise.all([
    encryption.decrypt(obj.name_enc),
    encryption.decrypt(obj.email_enc),
    encryption.decrypt(obj.phone_enc),
  ]);
  return {
    id: obj._id,
    name,
    email,
    phone,
    message: obj.message,
    status: obj.status,
    // sentBy is required (every reply has a real admin sender, unlike
    // statusHistory.changedBy which can be system-generated), so unlike
    // that field this never needs a null branch — only populated-vs-raw,
    // depending on whether the query populated 'replies.sentBy'.
    replies: (obj.replies || []).map((r) => ({
      message: r.message,
      sentBy:
        r.sentBy && typeof r.sentBy === 'object'
          ? { id: r.sentBy._id.toString(), name: r.sentBy.name }
          : { id: r.sentBy.toString(), name: null },
      date: r.date,
    })),
    createdAt: obj.createdAt,
  };
}

async function submitInquiry({ name, email, phone, message }) {
  const [name_enc, email_enc, phone_enc, name_bidx, email_bidx] = await Promise.all([
    encryption.encrypt(name),
    encryption.encrypt(email),
    encryption.encrypt(phone || null),
    blindIndex.computeBlindIndex(name),
    blindIndex.computeBlindIndex(email),
  ]);

  const inquiry = await Inquiry.create({
    name_enc,
    name_bidx,
    email_enc,
    email_bidx,
    phone_enc,
    message,
    status: INQUIRY_STATUS.OPEN,
  });

  await logAudit({ action: 'inquiry.submitted', targetType: 'Inquiry', targetId: inquiry._id });
  return inquiry;
}

async function listInquiries({ status, page = 1, limit = 20 }) {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Inquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Inquiry.countDocuments(filter),
  ]);

  const items = await Promise.all(docs.map(toDecryptedJSON));
  return { items, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

// Was missing — admin could only see inquiries via the list, never fetch one directly.
async function getInquiryById(id) {
  const inquiry = await Inquiry.findById(id).populate('replies.sentBy', 'name');
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  return toDecryptedJSON(inquiry);
}

async function replyToInquiry(id, message, actorId, actorName) {
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw ApiError.notFound('Inquiry not found');

  const email = await encryption.decrypt(inquiry.email_enc);
  const name = await encryption.decrypt(inquiry.name_enc);

  await sendEmail({
    to: email,
    toName: name,
    subject: 'Liko Security Training — Response to your inquiry',
    html: `<p>Dear ${name},</p><p>${message.replace(/\n/g, '</p><p>')}</p><p>— Liko Security Training</p>`,
  });

  inquiry.replies.push({ message, sentBy: actorId, date: new Date() });
  inquiry.status = INQUIRY_STATUS.REPLIED; // FR-INQ-04
  await inquiry.save();
  await inquiry.populate('replies.sentBy', 'name');

  await logAudit({ actor: actorId, action: 'inquiry.replied', targetType: 'Inquiry', targetId: id });
  return toDecryptedJSON(inquiry);
}

module.exports = { submitInquiry, listInquiries, getInquiryById, replyToInquiry, toDecryptedJSON };
