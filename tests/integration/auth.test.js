'use strict';

const request = require('supertest');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setupTestDB');

let app;
let Role;
let User;
let encryption;
let blindIndex;
let authUtils;

beforeAll(async () => {
  await setupTestDB();
  // Required only after MONGO_URI is set by setupTestDB, and app.js must be
  // required fresh so config/db.js etc. pick up the in-memory URI.
  app = require('../../app');
  Role = require('../../src/modules/roles/role.model');
  User = require('../../src/modules/users/user.model');
  encryption = require('../../src/shared/security/encryption');
  blindIndex = require('../../src/shared/security/blindIndex');
  authUtils = require('../../src/modules/auth/auth.utils');
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

async function seedUser({ email = 'admin@liko.test', password = 'SuperSecret123!', permissions = ['users:manage'], isActive = true } = {}) {
  const role = await Role.create({ name: 'Test Role', permissions, isSystemRole: false });
  const user = await User.create({
    name: 'Test Admin',
    email_enc: await encryption.encrypt(email),
    email_bidx: await blindIndex.computeBlindIndex(email),
    passwordHash: await authUtils.hashPassword(password),
    role: role._id,
    isActive,
  });
  return { role, user };
}

describe('POST /api/v1/auth/login', () => {
  test('returns access + refresh tokens on valid credentials', async () => {
    await seedUser({ email: 'valid@liko.test', password: 'CorrectHorse123!' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'valid@liko.test', password: 'CorrectHorse123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  test('returns a generic message on wrong password (no user enumeration)', async () => {
    await seedUser({ email: 'known@liko.test', password: 'CorrectHorse123!' });

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'known@liko.test', password: 'WrongPassword!' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@liko.test', password: 'WrongPassword!' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message); // FR-AUTH-01
  });

  test('blocks login for a deactivated account', async () => {
    await seedUser({ email: 'gone@liko.test', password: 'CorrectHorse123!', isActive: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'gone@liko.test', password: 'CorrectHorse123!' });

    expect(res.status).toBe(403);
  });
});

describe('Permission enforcement', () => {
  test('a protected route with no token returns 401, not 500', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  test('a valid token lacking the required permission returns 403, not 500', async () => {
    await seedUser({ email: 'nopermission@liko.test', password: 'CorrectHorse123!', permissions: ['gallery:manage'] });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nopermission@liko.test', password: 'CorrectHorse123!' });

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(403);
  });

  test('a valid token with the required permission succeeds', async () => {
    await seedUser({ email: 'hasaccess@liko.test', password: 'CorrectHorse123!', permissions: ['users:manage'] });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hasaccess@liko.test', password: 'CorrectHorse123!' });

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
