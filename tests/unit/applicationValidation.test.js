'use strict';

const mongoose = require('mongoose');
const { submitApplication } = require('../../src/modules/applications/application.validation');

function baseValidPayload(overrides = {}) {
  return {
    firstName: 'Nomvula',
    lastName: 'Khumalo',
    idType: 'sa_id',
    idNumber: '8001015009087',
    phone: '0821234567',
    email: 'nomvula@example.com',
    address: { street: '1 Main Rd', suburb: 'KwaMajova', city: 'Mount Frere', province: 'EC', postalCode: '5090' },
    coursesSelected: [new mongoose.Types.ObjectId().toString()],
    preferredIntake: new mongoose.Types.ObjectId().toString(),
    consentGiven: true,
    ...overrides,
  };
}

describe('application.validation — POPIA consent (submitApplication schema)', () => {
  test('accepts a payload with consentGiven: true', () => {
    const { error } = submitApplication.validate(baseValidPayload());
    expect(error).toBeUndefined();
  });

  test('rejects when consentGiven is missing entirely', () => {
    const payload = baseValidPayload();
    delete payload.consentGiven;
    const { error } = submitApplication.validate(payload);
    expect(error).toBeDefined();
    expect(error.details.some((d) => d.path.includes('consentGiven'))).toBe(true);
  });

  test('rejects when consentGiven is explicitly false', () => {
    const { error } = submitApplication.validate(baseValidPayload({ consentGiven: false }));
    expect(error).toBeDefined();
    expect(error.details.some((d) => d.path.includes('consentGiven'))).toBe(true);
  });

  test('accepts the string "true" (multipart/form-data field coercion)', () => {
    // Joi's default convert:true coerces "true"/"false" strings for boolean
    // schemas — this is how the value actually arrives from a multipart form
    // submission via the /apply page, not as a native boolean.
    const { error } = submitApplication.validate(baseValidPayload({ consentGiven: 'true' }));
    expect(error).toBeUndefined();
  });

  test('rejects the string "false"', () => {
    const { error } = submitApplication.validate(baseValidPayload({ consentGiven: 'false' }));
    expect(error).toBeDefined();
  });
});
