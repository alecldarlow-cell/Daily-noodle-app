/* eslint-disable @typescript-eslint/no-require-imports */
import type { PuzzleType } from '../ids';
import {
  monthName,
  readStats,
  STATS_TYPES,
  statsRows,
  statsSummary,
  statsYearCard,
  yearShare,
  type StatsMode,
} from '../stats';
import { rng, type Rng } from './gen';
import { fakeStorage } from './site';

/** The site's own dn-stats.js, vendored verbatim by scripts/vendor-site.js. */
const site = require('../../vendor/dn-stats.js') as {
  read: (s: unknown) => unknown;
  summary: (s: unknown, o: unknown) => unknown;
  yearCard: (s: unknown, o: unknown) => unknown;
  yearShare: (y: unknown) => string;
};

const doc = (done: Record<string, unknown>) => ({ v: 1, done });

describe('GIVEN no saves', () => {
  it('THEN everything is zero, there is no year card, and nothing is written', () => {
    const st = fakeStorage();
    const set = jest.spyOn(st, 'setItem');
    const s = statsSummary(readStats(st), { today: '2026-11-06' });
    expect(s.overall).toEqual({ finished: 0, days: 0, run: 0, longest: 0, favourite: null });
    for (const t of STATS_TYPES) expect(s.types[t].n).toBe(0);
    expect(statsYearCard(readStats(st), { today: '2026-12-05' })).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('GIVEN broken or odd documents', () => {
  it('THEN they are skipped, not thrown', () => {
    const st = fakeStorage({
      'digi-doku-v1': [1, 2],
      'digi-path-v1': { v: 1, done: 'x' },
      'digi-link-v1': doc({ a: null, b: 7 }),
      'digi-sweep-v1': doc({ a: { o: 'win', s: -4, d: 'bad' } }),
    });
    st.m['digi-mini-v1'] = '{not json';
    const s = statsSummary(readStats(st), { today: '2026-11-06' });
    expect(s.overall.finished).toBe(1);
    expect(s.types.sweep.best).toBeNull();
  });
});

describe("GIVEN every type's record shape", () => {
  it('THEN each gives its own figures', () => {
    const d = '2026-11-01';
    const rows = statsRows(
      readStats(
        fakeStorage({
          'digi-mini-v1': doc({ m: { s: 62, d } }),
          'digi-sweep-v1': doc({ s1: { o: 'win', s: 80, d }, s2: { o: 'loss', s: 20, d } }),
          'digi-path-v1': doc({ p: { t: '02:05', d } }),
          'digi-link-v1': doc({
            l1: { o: 'win', t: '01:30', m: 1, d },
            l2: { o: 'loss', t: '03:00', m: 4, d },
          }),
          'digi-tangle-v1': doc({ g: { o: 'played', s: 48, w: 17, st: true, d } }),
          'digi-borders-v1': doc({ b: { c: 8, p: 650, secs: 90, ans: [], on: d } }),
          'digi-reckon-v1': doc({ r: { p: 720, b: 3, d } }),
          'digi-tally-v1': doc({ y: { t: '1:42' } }),
        }),
      ).docs,
    );
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect([by('m').secs, by('s1').secs, by('s2').won, by('p').secs]).toEqual([62, 80, false, 125]);
    expect([by('l1').secs, by('l1').mistakes, by('l2').secs]).toEqual([90, 1, null]);
    expect([by('g').score, by('g').words, by('g').star]).toEqual([48, 17, true]);
    expect([by('b').score, by('b').correct, by('b').played]).toEqual([650, 8, d]);
    expect([by('r').bulls, by('y').secs, by('y').played]).toEqual([3, 102, null]);
  });
});

describe('GIVEN on-the-day and catch-up plays', () => {
  it('THEN each mode counts only its own, and runs stay the same', () => {
    const sv = readStats(
      fakeStorage({
        'digi-mini-v1': doc({
          a: { s: 60, d: '2026-11-01' },
          b: { s: 70, d: '2026-11-05' },
          c: { s: 80 },
        }),
      }),
    );
    const dates = { a: '2026-11-01', b: '2026-11-02', c: '2026-11-03' };
    const f = (mode: StatsMode) => statsSummary(sv, { today: '2026-11-06', dates, mode }).overall;
    expect([f('all').finished, f('day').finished, f('archive').finished]).toEqual([3, 1, 1]);
    expect(f('archive').longest).toBe(1);
  });
});

describe('GIVEN the clock change and midnight', () => {
  it('THEN London days join up into one run', () => {
    const sv = readStats(
      fakeStorage({
        'digi-mini-v1': doc({
          a: { s: 1, d: '2026-10-24' },
          b: { s: 1, d: '2026-10-25' },
          c: { s: 1, d: '2026-10-26' },
        }),
        'digi-path-streak': { dates: ['2026-10-27'] },
      }),
    );
    expect(statsSummary(sv, { today: '2026-10-28' }).overall.run).toBe(4);
    expect(statsSummary(sv, { today: '2026-10-29' }).overall).toMatchObject({ run: 0, longest: 4 });
  });
});

describe('GIVEN the year card', () => {
  it('THEN it shows from 1 Dec to 31 Jan with 10 results, and shares one line with no link', () => {
    const done: Record<string, unknown> = {};
    for (let i = 1; i <= 10; i++)
      done['m' + i] = { s: 50 + i, d: '2026-11-' + String(i).padStart(2, '0') };
    const sv = readStats(fakeStorage({ 'digi-mini-v1': doc(done) }));
    expect(statsYearCard(sv, { today: '2026-11-30' })).toBeNull();
    const y = statsYearCard(sv, { today: '2027-01-10' })!;
    expect(y).toMatchObject({
      year: 2026,
      finished: 10,
      days: 10,
      longest: 10,
      busiest: '2026-11',
    });
    expect(yearShare(y)).toBe(
      '🍜 My 2026 in Noodle — 10 puzzles · 10 days · 🔥10 best run · Mini most',
    );
    expect(yearShare(null)).toBe('');
    expect(monthName('2026-02')).toBe('February');
  });
});

/** Random saves in every type's shape, including old ones missing newer fields. */
function randomSaves(g: Rng): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const types: PuzzleType[] = STATS_TYPES.filter(() => g.chance(0.8));
  for (const t of types) {
    const done: Record<string, unknown> = {};
    const n = g.int(0, 40);
    for (let i = 0; i < n; i++) {
      const d = g.chance(0.9) ? g.day() : undefined;
      const s = g.int(5, 900);
      const clockText = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      const rec: Record<string, unknown> = {
        mini: { s, d },
        doku: { s, d },
        sweep: { o: g.pick(['win', 'loss', 'gave']), s, d },
        path: { t: clockText, d },
        link: { o: g.pick(['win', 'loss']), t: clockText, m: g.int(0, 4), d },
        tangle: {
          o: 'played',
          s: g.int(0, 90),
          w: g.chance(0.8) ? g.int(0, 30) : undefined,
          st: g.chance(0.5),
          d,
        },
        borders: {
          c: g.int(0, 10),
          p: g.chance(0.8) ? g.int(0, 1000) : undefined,
          secs: s,
          ans: [],
          on: d,
        },
        reckon: { p: g.int(0, 1000), b: g.int(0, 10), secs: s, d },
        tally: g.chance(0.5) ? { t: clockText, s, d } : { t: clockText, d },
      }[t];
      done[`DP·${t.toUpperCase()}·${String(i).padStart(4, '0')}`] = JSON.parse(JSON.stringify(rec));
    }
    out[`digi-${t}-v1`] = { v: 1, done };
    if (g.chance(0.3)) out[`digi-${t}-streak`] = { dates: [g.day(), g.day()] };
  }
  return out;
}

describe('GIVEN random saves (differential against the site)', () => {
  it("THEN the app's stats equal dn-stats.js's, in every mode and on every date", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const g = rng(seed);
      const init = randomSaves(g);
      const st = fakeStorage(init);
      const today = g.day();
      const dates: Record<string, string> = {};
      for (const k of Object.keys(init))
        for (const id of Object.keys((init[k] as { done?: object }).done || {}))
          if (g.chance(0.7)) dates[id] = g.day();
      const theirs = site.read(st);
      const ours = readStats(st);
      for (const mode of ['all', 'day', 'archive'] as StatsMode[]) {
        const o = { today, dates, mode };
        expect(statsSummary(ours, o)).toEqual(site.summary(theirs, o));
      }
      const dec = `${today.slice(0, 4)}-12-${String(g.int(1, 31)).padStart(2, '0')}`;
      const yo = { today: g.chance(0.5) ? dec : today, dates };
      expect(statsYearCard(ours, yo)).toEqual(site.yearCard(theirs, yo));
      expect(yearShare(statsYearCard(ours, yo))).toBe(site.yearShare(site.yearCard(theirs, yo)));
    }
  });
});
