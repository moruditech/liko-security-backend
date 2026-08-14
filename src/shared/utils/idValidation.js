'use strict';

/**
 * South African ID number validation: 13 digits, YYMMDD birth-date prefix,
 * Luhn checksum on the final digit. FR-APP-02.
 */
function isValidSAId(idNumber) {
  if (!/^\d{13}$/.test(idNumber)) return false;

  // Basic YYMMDD plausibility check (doesn't know the century, so just checks
  // month/day are in valid ranges rather than a full calendar validation).
  const month = parseInt(idNumber.substring(2, 4), 10);
  const day = parseInt(idNumber.substring(4, 6), 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return luhnCheck(idNumber);
}

/**
 * Standard Luhn algorithm, applied to the 13-digit SA ID number.
 */
function luhnCheck(digits) {
  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Passport: alphanumeric, no checksum (FR-APP-02). Reasonable length bounds
 * (most passport numbers are 6-9 chars, but international formats vary —
 * kept permissive rather than falsely rejecting valid foreign passports).
 */
function isValidPassport(value) {
  return /^[A-Za-z0-9]{5,15}$/.test(value);
}

module.exports = { isValidSAId, isValidPassport };
