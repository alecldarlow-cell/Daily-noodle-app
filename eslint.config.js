// ESLint: Expo's rules, Prettier for formatting, and the feature-first boundaries
// from Piers' Technical Requirements §3: a feature imports only itself, shared and
// @noodle/core; routes import a feature only through its index.ts; shared never
// imports a feature.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const boundaries = require('eslint-plugin-boundaries');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['node_modules/**', 'coverage/**', '.expo/**', 'dist/**', 'packages/*/vendor/**'],
  },
  {
    // TypeScript checks imported names itself (and correctly through package export
    // maps, which import/namespace misreads, e.g. expo-splash-screen).
    files: ['**/*.{ts,tsx}'],
    rules: { 'import/namespace': 'off' },
  },
  {
    // Node scripts and config files.
    files: ['scripts/**/*.js', '*.config.js', 'test/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
      'boundaries/include': ['src/**/*', 'packages/*/src/**/*'],
      'boundaries/elements': [
        { type: 'route', pattern: 'src/app/**', mode: 'full' },
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'shared', pattern: 'src/shared/*', capture: ['module'] },
        { type: 'core', pattern: 'packages/core/src', mode: 'folder' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        2,
        {
          default: 'disallow',
          rules: [
            { from: 'route', allow: ['feature', 'shared', 'core', 'route'] },
            {
              from: 'feature',
              allow: [['feature', { feature: '${from.feature}' }], 'shared', 'core'],
            },
            { from: 'shared', allow: ['shared', 'core'] },
            { from: 'core', allow: ['core'] },
          ],
        },
      ],
      'boundaries/entry-point': [
        2,
        {
          default: 'disallow',
          rules: [
            { target: 'feature', allow: '**' },
            { target: 'shared', allow: '**' },
            { target: 'core', allow: '**' },
          ],
        },
      ],
    },
  },
  {
    // Routes reach a feature only through its public index.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        2,
        {
          patterns: [
            {
              group: ['@/features/*/*', '**/features/*/*'],
              message: 'Import a feature through its index.ts.',
            },
          ],
        },
      ],
    },
  },
]);
