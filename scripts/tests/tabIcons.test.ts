/* The tab bar's noodle-line icons (#199, Alec, 27 Nov 2026). */
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
const tabs = require('../make-tab-icons') as {
  TAB_ICONS: string[];
  stale: () => string[];
  render: () => { file: string; size: number; px: Float32Array }[];
};
/* eslint-enable @typescript-eslint/no-require-imports */

const root = `${__dirname}/../..`;

describe('GIVEN the tab icons in assets/images/tabs', () => {
  it('THEN there is one for each tab, at @1x, @2x and @3x', () => {
    expect(tabs.TAB_ICONS).toEqual(['today', 'leagues', 'archive', 'account']);
    expect(tabs.render().map((r) => `${r.file}:${r.size}`)).toEqual(
      tabs.TAB_ICONS.flatMap((n) => [`${n}.png:24`, `${n}@2x.png:48`, `${n}@3x.png:72`]),
    );
  });

  it('THEN every PNG is what make-tab-icons.js draws, so a change to the drawing needs a fresh run', () => {
    expect(tabs.stale()).toEqual([]);
  });

  it('THEN each is white on clear with a dot and a line, for the tab bar to tint', () => {
    for (const { px, size } of tabs.render()) {
      let ink = 0;
      let clear = 0;
      for (let i = 0; i < size * size; i++) {
        const a = px[i * 4 + 3]!;
        if (a > 0.5) {
          ink++;
          expect([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]).toEqual([255, 255, 255]);
        } else if (a === 0) clear++;
      }
      // Enough line to read, and mostly clear around it.
      expect(ink / (size * size)).toBeGreaterThan(0.08);
      expect(clear / (size * size)).toBeGreaterThan(0.5);
    }
  });

  it('THEN the tab bar uses them for Today, Leagues, Archive and Account, not the stock icons', () => {
    const src = readFileSync(`${root}/src/app/(tabs)/_layout.tsx`, 'utf8');
    for (const n of tabs.TAB_ICONS) {
      expect(src).toContain(`assets/images/tabs/${n}.png`);
      expect(src).toContain(`src={TAB_ICONS.${n}}`);
    }
    for (const stock of ['grid_view', 'trophy', 'calendar_month', 'account_circle'])
      expect(src).not.toContain(`md="${stock}"`);
  });
});
