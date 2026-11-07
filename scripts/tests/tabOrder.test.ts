/* The tab bar's order (Alec, 7 Nov 2026): most used first, nearest the thumb. */
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
/* eslint-enable @typescript-eslint/no-require-imports */

describe('GIVEN the tab bar', () => {
  it('THEN the tabs run Today, Leagues, Archive, (Stats), Account', () => {
    const src = readFileSync(`${__dirname}/../../src/app/(tabs)/_layout.tsx`, 'utf8');
    const names = [...src.matchAll(/<NativeTabs\.Trigger name="([a-z]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['index', 'leagues', 'archive', 'stats', 'account']);
  });
});
