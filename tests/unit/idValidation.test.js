'use strict';

const { isValidSAId, isValidPassport } = require('../../src/shared/utils/idValidation');

describe('isValidSAId', () => {
  test('accepts a known-valid SA ID (Luhn-correct)', () => {
    // 8001015009087 is a commonly used valid-checksum test SA ID number
    expect(isValidSAId('8001015009087')).toBe(true);
  });

  test('rejects wrong length', () => {
    expect(isValidSAId('12345')).toBe(false);
    expect(isValidSAId('12345678901234')).toBe(false);
  });

  test('rejects non-numeric input', () => {
    expect(isValidSAId('800101500908A')).toBe(false);
  });

  test('rejects invalid month/day', () => {
    expect(isValidSAId('8013015009087')).toBe(false); // month 13
    expect(isValidSAId('8001325009087')).toBe(false); // day 32
  });

  test('rejects a checksum-broken ID (last digit tampered)', () => {
    expect(isValidSAId('8001015009080')).toBe(false);
  });
});

describe('isValidPassport', () => {
  test('accepts alphanumeric passport numbers', () => {
    expect(isValidPassport('A1234567')).toBe(true);
    expect(isValidPassport('123456789')).toBe(true);
  });

  test('rejects too-short or symbol-containing values', () => {
    expect(isValidPassport('A123')).toBe(false);
    expect(isValidPassport('A123-4567')).toBe(false);
  });
});
