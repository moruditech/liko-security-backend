'use strict';

const { computeBlindIndex, normalize } = require('../../src/shared/security/blindIndex');

describe('blindIndex (HMAC-SHA-256)', () => {
  test('is deterministic — same input always produces the same index', async () => {
    const a = await computeBlindIndex('thabo@example.com');
    const b = await computeBlindIndex('thabo@example.com');
    expect(a).toBe(b);
  });

  test('is not reversible-looking — output is a hex digest, unrelated in form to input', async () => {
    const index = await computeBlindIndex('thabo@example.com');
    expect(index).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex digest length
  });

  test('normalizes case and whitespace identically at index time', async () => {
    const a = await computeBlindIndex('Thabo@Example.com');
    const b = await computeBlindIndex('  thabo@example.com  ');
    expect(a).toBe(b);
  });

  test('different inputs produce different indexes', async () => {
    const a = await computeBlindIndex('thabo@example.com');
    const b = await computeBlindIndex('sipho@example.com');
    expect(a).not.toBe(b);
  });

  test('returns null for empty/missing input', async () => {
    expect(await computeBlindIndex(null)).toBeNull();
    expect(await computeBlindIndex(undefined)).toBeNull();
    expect(await computeBlindIndex('')).toBeNull();
  });

  test('throws on non-string input', async () => {
    await expect(computeBlindIndex(42)).rejects.toThrow(TypeError);
  });

  test('normalize() is pure trim+lowercase, exported for query-time consistency', () => {
    expect(normalize('  Sipho MABASO ')).toBe('sipho mabaso');
  });
});
