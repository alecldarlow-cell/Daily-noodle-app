/* global jest */
// expo-audio for Jest (ADR-009): the real module needs its native side and fails to load
// outside a phone, so every test gets these stand-ins. `__played` lists the source of
// every play(), in order, for tests to read (and empty).
const played = [];

const createAudioPlayer = jest.fn((source) => ({
  source,
  play: jest.fn(() => {
    played.push(source);
  }),
  pause: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  remove: jest.fn(),
  volume: 1,
}));

module.exports = {
  __played: played,
  createAudioPlayer,
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioPlayer: jest.fn((source) => createAudioPlayer(source)),
};
