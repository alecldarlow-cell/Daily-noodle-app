/* global jest */
// expo-store-review for Jest (ADR-010): the real module needs its native side. Tests set what
// the store answers and read how often the app asked.
module.exports = {
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  hasAction: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
  storeUrl: jest.fn(() => null),
};
