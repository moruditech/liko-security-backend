'use strict';

/**
 * Generates the applicant-facing payment reference: LIKO-<SURNAME>-<sequence>.
 * Collision-checked by the caller (application.service.js) against the DB before
 * assignment — this module only knows how to format and increment, not persist.
 *
 * @param {string} surname
 * @param {(candidate: string) => Promise<boolean>} existsCheck - returns true if the
 *   candidate reference code is already taken
 */
async function generateReferenceCode(surname, existsCheck) {
  const cleanSurname = String(surname)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '') || 'APPLICANT';

  let sequence = 1;
  let candidate;
  const MAX_ATTEMPTS = 50;

  do {
    candidate = `LIKO-${cleanSurname}-${sequence}`;
    // eslint-disable-next-line no-await-in-loop
    const taken = await existsCheck(candidate);
    if (!taken) return candidate;
    sequence += 1;
  } while (sequence <= MAX_ATTEMPTS);

  // Extremely unlikely (50 applicants with the exact same surname mid-collision-race),
  // but fail loudly rather than silently returning a colliding code.
  throw new Error(`[generateReference] Could not generate a unique reference code for surname "${surname}" after ${MAX_ATTEMPTS} attempts`);
}

module.exports = { generateReferenceCode };
