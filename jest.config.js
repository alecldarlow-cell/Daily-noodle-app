/** Single test runner for the app and packages (ADR-004). */

const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  // The preset's own setup first, then ours, which needs its globals installed.
  setupFiles: [...preset.setupFiles, '<rootDir>/test/resolve-lazy-globals.js'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/.expo/'],
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@noodle/core$': '<rootDir>/packages/core/src/index.ts',
    // AsyncStorage's own in-memory mock (its docs' recommended Jest setup).
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
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
