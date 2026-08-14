'use strict';

const { APPLICATION_STATUS, APPLICATION_STATUS_TRANSITIONS } = require('../../src/shared/constants/enums');

describe('APPLICATION_STATUS_TRANSITIONS', () => {
  test('new can move to under_review or rejected only', () => {
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.NEW]).toEqual(
      expect.arrayContaining([APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.REJECTED])
    );
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.NEW]).toHaveLength(2);
  });

  test('under_review can move to payment_verified or rejected', () => {
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.UNDER_REVIEW]).toEqual(
      expect.arrayContaining([APPLICATION_STATUS.PAYMENT_VERIFIED, APPLICATION_STATUS.REJECTED])
    );
  });

  test('payment_verified can move to enrolled or rejected', () => {
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.PAYMENT_VERIFIED]).toEqual(
      expect.arrayContaining([APPLICATION_STATUS.ENROLLED, APPLICATION_STATUS.REJECTED])
    );
  });

  test('enrolled and rejected are terminal — no further transitions', () => {
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.ENROLLED]).toEqual([]);
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.REJECTED]).toEqual([]);
  });

  test('cannot skip stages, e.g. new -> enrolled directly is not allowed', () => {
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.NEW]).not.toContain(APPLICATION_STATUS.ENROLLED);
    expect(APPLICATION_STATUS_TRANSITIONS[APPLICATION_STATUS.NEW]).not.toContain(APPLICATION_STATUS.PAYMENT_VERIFIED);
  });

  test('cannot re-enter new from any later stage', () => {
    Object.values(APPLICATION_STATUS).forEach((status) => {
      if (status === APPLICATION_STATUS.NEW) return;
      expect(APPLICATION_STATUS_TRANSITIONS[status]).not.toContain(APPLICATION_STATUS.NEW);
    });
  });
});
