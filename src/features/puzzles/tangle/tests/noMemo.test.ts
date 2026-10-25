// Node's fs and path, typed here: the app's tsconfig has no Node types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync(file: string, enc: 'utf8'): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as { join(...parts: string[]): string };
declare const __dirname: string;

const COMPONENTS = path.join(__dirname, '..', 'components');

describe('GIVEN the screens that draw the Tangle engine (one object mutated in place)', () => {
  describe('WHEN React Compiler builds the app', () => {
    it('THEN they opt out, or the count-in and clock never redraw on a phone', () => {
      for (const f of ['TangleScreen.tsx', 'TangleBoard.tsx']) {
        const first = fs.readFileSync(path.join(COMPONENTS, f), 'utf8').split('\n')[0];
        expect(`${f}: ${first}`).toBe(`${f}: 'use no memo';`);
      }
    });
  });
});
