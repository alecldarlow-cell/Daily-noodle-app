// Expo's runtime (expo/src/winter) installs several globals as lazy getters that
// `require` their implementation on first read. Jest 30 reads every global while
// tearing a suite down, outside test code, where such a `require` is refused and
// the suite fails ("You are trying to `import` a file outside of the scope of the
// test code"). Reading them here, during setup, resolves each getter to its value
// once, so teardown finds plain values. Test-only; the app is unaffected.
for (const name of [
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'DOMException',
  '__ExpoImportMetaRegistry',
  'structuredClone',
  'fetch',
]) {
  void globalThis[name];
}
