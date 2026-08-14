'use strict';

const { getMailjetClient, SENDER_EMAIL, SENDER_NAME } = require('../../config/mailjet');
const env = require('../../config/env');

/**
 * Generic transactional email sender. Domain-specific templates (invoice emails,
 * inquiry replies, etc.) build their HTML via EJS templates (Phase 3) and call
 * this as the transport layer. Kept generic here because auth needs email
 * (password reset, FR-AUTH-06) before the invoice/PDF workflow exists.
 */
async function sendEmail({ to, toName, subject, html, attachments = [] }) {
  if (env.isTest) {
    // Never hit the real Mailjet API from the test suite.
    return { skipped: true };
  }

  const mailjet = getMailjetClient();

  const message = {
    From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
    To: [{ Email: to, Name: toName || to }],
    Subject: subject,
    HTMLPart: html,
  };

  if (attachments.length > 0) {
    message.Attachments = attachments.map((a) => ({
      ContentType: a.contentType,
      Filename: a.filename,
      Base64Content: a.base64Content,
    }));
  }

  const result = await mailjet.post('send', { version: 'v3.1' }).request({ Messages: [message] });
  return result.body;
}

module.exports = { sendEmail };
