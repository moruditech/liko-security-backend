'use strict';

const Mailjet = require('node-mailjet');
const env = require('./env');

let client = null;

/**
 * Lazily instantiated so unit tests / dev without Mailjet creds don't crash at require-time.
 */
function getMailjetClient() {
  if (!client) {
    if (!env.MAILJET_API_KEY || !env.MAILJET_API_SECRET) {
      throw new Error('[mailjet] MAILJET_API_KEY / MAILJET_API_SECRET not configured');
    }
    client = Mailjet.apiConnect(env.MAILJET_API_KEY, env.MAILJET_API_SECRET);
  }
  return client;
}

module.exports = {
  getMailjetClient,
  SENDER_EMAIL: env.MAILJET_SENDER_EMAIL,
  SENDER_NAME: env.MAILJET_SENDER_NAME,
};
