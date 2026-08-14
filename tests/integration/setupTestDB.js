'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

/**
 * Boots an in-memory MongoDB instance once per test file. Integration tests
 * import this alongside supertest + the exported `app` (never server.js,
 * which would try to bind a real port and call process.exit on failure).
 */
async function setupTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
}

async function teardownTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { setupTestDB, teardownTestDB, clearTestDB };
