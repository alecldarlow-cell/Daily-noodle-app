/** Single test runner for the app and packages (ADR-004). */

const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  // The preset's own setup first, then ours, which needs its globals installed.
  setupFiles: [...preset.setupFiles, '<rootDir>/test/resolve-lazy-globals.js'],
  // A sound file becomes its cue's name, so tests can tell which sound played (ADR-009);
  // first, so it wins over the preset's asset stub.
  transform: { '\\.wav$': '<rootDir>/test/wav-transformer.js', ...preset.transform },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/.expo/'],
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@noodle/core$': '<rootDir>/packages/core/src/index.ts',
    // AsyncStorage's own in-memory mock (its docs' recommended Jest setup).
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    // NetInfo's own Jest mock (its docs' recommended setup; ADR-008): the real module needs
    // its native side and fails outside a phone.
    '^@react-native-community/netinfo$':
      '<rootDir>/node_modules/@react-native-community/netinfo/jest/netinfo-mock.js',
    // expo-audio ships no Jest mock and can't load without its native side (ADR-009).
    '^expo-audio$': '<rootDir>/test/mocks/expo-audio.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
    '!src/app/**',
    '!**/index.ts',
    '!**/*.d.ts',
    '!**/tests/fixtures/**',
    '!src/shared/testing/**',
  ],
  coverageThreshold: {
    global: { lines: 80, statements: 80, functions: 80, branches: 70 },
  },
  coverageReporters: ['text-summary', 'lcov'],
};
