declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require('child_process') as {
  execFileSync: (f: string, a: string[], o: { cwd: string; encoding: 'utf8' }) => string;
};

const root = `${__dirname}/../..`;
const store = JSON.parse(readFileSync(`${root}/store/runtime.json`, 'utf8')) as { android: string };

/** This checkout's Android runtime version, as `eas update` computes it (expo's fingerprint). */
function androidFingerprint(): string {
  const cli = `${root}/node_modules/@expo/fingerprint/bin/cli.js`;
  const out = execFileSync(
    process.execPath,
    [cli, 'fingerprint:generate', '--platform', 'android'],
    { cwd: root, encoding: 'utf8' },
  );
  return (JSON.parse(out) as { hash: string }).hash;
}

describe('GIVEN the build testers have from Google Play (store/runtime.json)', () => {
  describe('WHEN this checkout is fingerprinted as EAS Update does', () => {
    it('THEN it matches, so a production update reaches their phones', () => {
      // A mismatch means something native changed (a native dependency, app.json, icons, or
      // the root .gitignore, which feeds the fingerprint). Updates then go to a runtime no
      // store build has, silently. Undo the change, or ship a new store build and then
      // record its runtime version in store/runtime.json.
      expect(androidFingerprint()).toBe(store.android);
    }, 60_000);
  });
});
