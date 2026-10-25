// eslint-disable-next-line @typescript-eslint/no-require-imports
const { plan, pageOf, spread, SHARDS, RECENT_CAP } = require('../replay-watch') as {
  plan: (a: {
    types: string[];
    hashes: Record<string, string>;
    verified: Record<string, string> | null;
    changedFiles: string[];
    fullAll?: boolean;
  }) => {
    full: { type: string; shard: string }[];
    recent: { type: string; only: string }[];
    seeded: boolean;
  };
  pageOf: (f: string, types: string[]) => { type: string; only: string } | null;
  spread: <T>(l: T[], n: number) => T[];
  SHARDS: Record<string, number>;
  RECENT_CAP: number;
};

const TYPES = ['doku', 'link', 'mini', 'sweep'];
const H = { doku: 'd1', link: 'l1', mini: 'm1', sweep: 's1' };
const mini = (n: number) =>
  `reports/2026-11-${String(n).padStart(2, '0')}-crossword-mini-0${100 + n}.html`;

describe('GIVEN the nightly replay deciding what to run', () => {
  it('THEN with no record yet, today’s engines count as verified: nothing in full', () => {
    const r = plan({ types: TYPES, hashes: H, verified: null, changedFiles: [] });
    expect(r.full).toEqual([]);
    expect(r.seeded).toBe(true);
  });

  it('THEN a type whose site engine changed is replayed in full, in its shards', () => {
    const r = plan({ types: TYPES, hashes: H, verified: { ...H, sweep: 'old' }, changedFiles: [] });
    expect(r.full).toEqual(
      Array.from({ length: SHARDS.sweep! }, (_, i) => ({
        type: 'sweep',
        shard: `${i + 1}/${SHARDS.sweep}`,
      })),
    );
  });

  it('THEN new or edited puzzle pages of native types are replayed, once each; others ignored', () => {
    const r = plan({
      types: TYPES,
      hashes: H,
      verified: H,
      changedFiles: [
        mini(2),
        mini(2),
        'reports/2026-11-02-crossword-mini-0102.json',
        'reports/2026-11-02-word-tangle-0030.html',
        'reports/2026-11-02-uk-news-piece.html',
        'feed.json',
      ],
    });
    expect(r.full).toEqual([]);
    expect(r.recent).toEqual([{ type: 'mini', only: '2026-11-02-crossword-mini-0102' }]);
  });

  it('THEN a bulk edit is sampled: at most the cap per type, spread across the pages', () => {
    const files = Array.from({ length: 90 }, (_, i) => mini((i % 28) + 1).replace('0', String(i)));
    const r = plan({ types: TYPES, hashes: H, verified: H, changedFiles: files });
    expect(r.recent.length).toBeLessThanOrEqual(RECENT_CAP);
    expect(spread([1, 2, 3, 4, 5, 6], 3)).toEqual([1, 3, 5]);
    expect(spread([1, 2], 3)).toEqual([1, 2]);
  });

  it('THEN a type replayed in full isn’t also replayed page by page; Run workflow can force all', () => {
    const r = plan({
      types: TYPES,
      hashes: H,
      verified: { ...H, mini: 'old' },
      changedFiles: [mini(2), 'reports/2026-11-02-logic-doku-0020.html'],
    });
    expect(r.recent).toEqual([{ type: 'doku', only: '2026-11-02-logic-doku-0020' }]);
    const all = plan({ types: TYPES, hashes: H, verified: H, changedFiles: [], fullAll: true });
    expect(new Set(all.full.map((j) => j.type))).toEqual(new Set(TYPES));
  });

  it('THEN page names map to their types', () => {
    expect(pageOf('reports/2026-10-25-geo-borders-0021.html', ['borders'])).toEqual({
      type: 'borders',
      only: '2026-10-25-geo-borders-0021',
    });
    expect(pageOf('reports/2026-10-25-geo-borders-0021.html', ['mini'])).toBeNull();
    expect(pageOf('index.html', TYPES)).toBeNull();
  });
});
