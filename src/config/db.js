'use strict';

const mongoose = require('mongoose');
const env = require('./env');

/**
 * Connects to MongoDB. TLS is enforced via the connection string itself
 * (mongodb+srv:// on Atlas implies TLS; for self-hosted, ?tls=true must be present) —
 * we defensively check for it here rather than trusting it silently, per TAD §11.
 */
async function connectDB() {
  const uri = env.MONGO_URI;

  const looksTLSEnforced =
    uri.startsWith('mongodb+srv://') || /[?&]tls=true/i.test(uri) || /[?&]ssl=true/i.test(uri);

  if (!looksTLSEnforced && env.isProduction) {
    // eslint-disable-next-line no-console
    console.error('[db] MONGO_URI does not appear to enforce TLS. Refusing to connect in production.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });

  // eslint-disable-next-line no-console
  console.log(`[db] MongoDB connected (${env.NODE_ENV})`);

  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[db] MongoDB disconnected');
  });
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
