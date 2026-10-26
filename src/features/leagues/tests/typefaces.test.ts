// Node's fs and path, typed here: the app's tsconfig has no Node types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as {
  readFileSync(file: string, enc: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(p: string): { isDirectory(): boolean };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as { join(...parts: string[]): string };
declare const __dirname: string;

const FEATURES = path.join(__dirname, '..', '..');

function tsxUnder(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) return name === 'tests' ? [] : tsxUnder(p);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [p] : [];
  });
}

describe('GIVEN the Leagues and Account tabs', () => {
  describe('WHEN their styles are read', () => {
    it('THEN they use the app’s typefaces, never a system weight (Android drops a custom face under one)', () => {
      const files = [
        ...tsxUnder(path.join(FEATURES, 'leagues')),
        ...tsxUnder(path.join(FEATURES, 'account')),
      ];
      expect(files.length).toBeGreaterThan(8);
      const bad = files.filter((f) => /fontWeight|'Georgia'/.test(fs.readFileSync(f, 'utf8')));
      expect(bad).toEqual([]);
    });
  });
});
