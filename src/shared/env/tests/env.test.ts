// Node's fs and path, typed here: the app's tsconfig has no Node types.
interface Entry {
  name: string;
  isDirectory(): boolean;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as {
  readdirSync(dir: string, o: { withFileTypes: true }): Entry[];
  readFileSync(file: string, enc: 'utf8'): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
};
declare const __dirname: string;

const SRC = path.join(__dirname, '..', '..', '..');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'tests' ? [] : sources(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('GIVEN the app’s source', () => {
  describe('WHEN it reads the build’s settings', () => {
    it('THEN every read spells out process.env.EXPO_PUBLIC_NAME, the only form Expo fills in', () => {
      const bad = sources(SRC).flatMap((f) =>
        fs
          .readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${path.relative(SRC, f)}:${i + 1}` }))
          .filter(({ line }) => !/^\s*(\*|\/\/|\/\*)/.test(line)) // prose in comments is fine
          .filter(({ line }) => /process\.env(?!\.EXPO_PUBLIC_[A-Z0-9_]+)/.test(line))
          .map(({ at }) => at),
      );
      expect(bad).toEqual([]);
    });
  });
});

describe('GIVEN BUILD_ENV', () => {
  it('THEN it carries the three settings the app uses', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BUILD_ENV } = require('..') as { BUILD_ENV: Record<string, unknown> };
    expect(Object.keys(BUILD_ENV).sort()).toEqual([
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SYNC',
    ]);
  });
});
