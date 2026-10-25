import { FONT, FONT_FILES } from '../fonts';

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

const SRC = path.join(__dirname, '..', '..', '..');

function tsxUnder(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) return name === 'tests' ? [] : tsxUnder(p);
    return name.endsWith('.tsx') ? [p] : [];
  });
}

describe('GIVEN the bundled typefaces', () => {
  describe('WHEN the app loads its fonts', () => {
    it('THEN every family the screens name has a file behind it', () => {
      for (const family of Object.values(FONT)) {
        expect(`${family}: ${typeof FONT_FILES[family]}`).toBe(`${family}: number`);
      }
    });
  });
});

describe('GIVEN the eight players, their start cards and finish sheet', () => {
  describe('WHEN their styles are read', () => {
    it('THEN no text falls back to Georgia or a system weight (Android drops a custom face under a weight)', () => {
      const files = [
        ...tsxUnder(path.join(SRC, 'features', 'puzzles')),
        ...tsxUnder(path.join(SRC, 'shared', 'start-card')),
        ...tsxUnder(path.join(SRC, 'shared', 'finish-sheet')),
      ];
      expect(files.length).toBeGreaterThan(30);
      const bad = files.flatMap((f) => {
        const src = fs.readFileSync(f, 'utf8');
        return /fontWeight|'Georgia'/.test(src) ? [f] : [];
      });
      expect(bad).toEqual([]);
    });
  });
});
