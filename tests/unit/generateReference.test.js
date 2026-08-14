'use strict';

const { generateReferenceCode } = require('../../src/shared/utils/generateReference');

describe('generateReferenceCode', () => {
  test('formats as LIKO-<SURNAME>-<sequence>, uppercased', async () => {
    const code = await generateReferenceCode('mokoena', async () => false);
    expect(code).toBe('LIKO-MOKOENA-1');
  });

  test('strips non-letter characters from the surname', async () => {
    const code = await generateReferenceCode("O'Brien-Smith 2nd", async () => false);
    expect(code).toBe('LIKO-OBRIENSMITHND-1');
  });

  test('increments sequence on collision until a free slot is found', async () => {
    const taken = new Set(['LIKO-DLAMINI-1', 'LIKO-DLAMINI-2']);
    const code = await generateReferenceCode('Dlamini', async (candidate) => taken.has(candidate));
    expect(code).toBe('LIKO-DLAMINI-3');
  });

  test('falls back to APPLICANT when surname has no letters', async () => {
    const code = await generateReferenceCode('123', async () => false);
    expect(code).toBe('LIKO-APPLICANT-1');
  });

  test('throws if it cannot find a free slot after max attempts', async () => {
    await expect(generateReferenceCode('Ngcobo', async () => true)).rejects.toThrow(
      'Could not generate a unique reference code'
    );
  });
});
