'use strict';

const { encrypt, decrypt, encryptFields, decryptFields } = require('../../src/shared/security/encryption');

describe('encryption (AES-256-GCM)', () => {
  test('round-trips a plaintext string', async () => {
    const plaintext = 'Thabo Mokoena';
    const ciphertext = await encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(typeof ciphertext).toBe('string');
    expect(ciphertext.split('.')).toHaveLength(3); // iv.authTag.ciphertext

    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  test('produces different ciphertext for the same plaintext each time (random IV)', async () => {
    const a = await encrypt('0821234567');
    const b = await encrypt('0821234567');
    expect(a).not.toBe(b);
    expect(await decrypt(a)).toBe('0821234567');
    expect(await decrypt(b)).toBe('0821234567');
  });

  test('passes null/undefined/empty through untouched', async () => {
    expect(await encrypt(null)).toBeNull();
    expect(await encrypt(undefined)).toBeNull();
    expect(await encrypt('')).toBeNull();
    expect(await decrypt(null)).toBeNull();
    expect(await decrypt('')).toBeNull();
  });

  test('throws on non-string input', async () => {
    await expect(encrypt(12345)).rejects.toThrow(TypeError);
  });

  test('detects tampering via auth tag (rejects modified ciphertext)', async () => {
    const ciphertext = await encrypt('sensitive-id-number-8501015800086');
    const parts = ciphertext.split('.');
    // Flip a byte in the ciphertext portion
    const tamperedBuf = Buffer.from(parts[2], 'base64');
    tamperedBuf[0] ^= 0xff;
    parts[2] = tamperedBuf.toString('base64');
    const tampered = parts.join('.');

    await expect(decrypt(tampered)).rejects.toThrow();
  });

  test('rejects malformed ciphertext payloads', async () => {
    await expect(decrypt('not-a-valid-payload')).rejects.toThrow('Malformed ciphertext payload');
  });

  test('encryptFields/decryptFields round-trip an object subset', async () => {
    const address = { street: '12 Main Rd', suburb: 'KwaMajova', city: 'Mount Frere', postalCode: '5090' };
    const encrypted = await encryptFields(address, ['street']);
    expect(encrypted.street).not.toBe(address.street);
    expect(encrypted.suburb).toBe(address.suburb); // untouched field

    const decrypted = await decryptFields(encrypted, ['street']);
    expect(decrypted.street).toBe(address.street);
  });
});
