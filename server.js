'use strict';

const app = require('./app');
const env = require('./src/config/env');
const { connectDB, disconnectDB } = require('./src/config/db');
const { closeBrowser } = require('./src/shared/utils/pdfRenderer');

let server;

async function start() {
  await connectDB();

  server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Liko backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

async function gracefulShutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[server] Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await disconnectDB();
      await closeBrowser();
      // eslint-disable-next-line no-console
      console.log('[server] Shutdown complete');
      process.exit(0);
    });
    // Force-exit if close hangs
    setTimeout(() => process.exit(1), 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[server] Unhandled promise rejection:', reason);
  // Fail loudly rather than continuing in an unknown state
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
