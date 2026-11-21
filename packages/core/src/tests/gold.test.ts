/**
 * Gold stars (21 Nov 2026, Alec): @noodle/core's gold() against the site's dnCore.gold rules.
 * CASES is the site's own list (dailynoodle tools/tests/unit/gold.test.js), and every case is
 * also run through the vendored dn-core.js (scripts/vendor-site.js), so the two can't drift.
 */
import { gold } from '../gold';
import { playedState } from '../played';
import { loadDnCore } from './site';

const CASES: [string, Record<string, unknown>, boolean][] = [
  ['mini', { s: 40 }, true],
  ['mini', { s: 41 }, false],
  ['mini', { s: 12, h: 1 }, false],
  ['mini', { s: 30, d: '2026-11-01' }, true],
  ['doku', { s: 30 }, true],
  ['doku', { s: 31 }, false],
  ['sweep', { o: 'win', s: 30 }, true],
  ['sweep', { o: 'win', s: 31 }, false],
  ['sweep', { o: 'loss', s: 9, b: 4 }, false],
  ['path', { t: '0:20' }, true],
  ['path', { t: '00:20' }, true],
  ['path', { t: '00:21' }, false],
  ['tally', { t: '1:00', s: 60 }, true],
  ['tally', { t: '1:01', s: 61 }, false],
  ['tally', { t: '0:59' }, true],
  ['link', { o: 'win', m: 0, t: '00:59' }, true],
  ['link', { o: 'win', m: 0, t: '01:01' }, false],
  ['link', { o: 'win', m: 1, t: '00:30' }, false],
  ['link', { o: 'loss', m: 4, t: '00:30' }, false],
  ['link', { o: 'win', t: '00:30' }, false],
  ['tangle', { s: 40 }, true],
  ['tangle', { s: 39 }, false],
  ['borders', { p: 1000, c: 10 }, true],
  ['borders', { p: 950, c: 10 }, false],
  ['borders', { c: 10 }, true],
  ['borders', { p: 1200, c: 9 }, false],
  ['reckon', { p: 750 }, true],
  ['reckon', { p: 740 }, false],
];

describe('GIVEN the gold star rules (GOLD-01..03, as the site)', () => {
  describe('WHEN each daily type is judged either side of its threshold', () => {
    it('THEN gold comes exactly at the threshold, and never on a loss', () => {
      for (const [type, rec, want] of CASES)
        expect([type, rec, !!gold(type, rec)]).toEqual([type, rec, want]);
    });
  });
  describe('WHEN the same cases go through the site’s own dn-core.js', () => {
    it('THEN every reason matches, word for word', () => {
      const site = loadDnCore() as unknown as { gold: (t: string, r: unknown) => string };
      for (const [type, rec] of CASES)
        expect([type, rec, gold(type, rec)]).toEqual([type, rec, site.gold(type, rec)]);
    });
  });
  describe('WHEN a result is gold', () => {
    it('THEN it says what earned it; anything else says nothing', () => {
      expect(gold('borders', { p: 1000, c: 10 })).toBe('A perfect ten');
      expect(gold('path', { t: '0:15' })).toBe('Under 0:20');
      expect(gold('link', { o: 'win', m: 0, t: '00:40' })).toBe('No mistakes, under 1:00');
      expect(gold('mini', { s: 20 })).toBe('Under 0:40 with no checks or reveals');
      expect(gold('mini', { s: 20, h: 1 })).toBe('');
    });
  });
  describe('WHEN the type is a Lab trial, unknown, or the record is broken', () => {
    it('THEN there is never gold, and nothing throws', () => {
      for (const t of ['tilt', 'redact', 'tumbler', 'cryptic', 'nope', 'constructor', 'toString'])
        expect(gold(t, { s: 1, t: '0:01', p: 9999 })).toBe('');
      for (const r of [null, undefined, 'x', 5, [], {}, { s: 'fast' }, { t: 'soon' }])
        for (const t of ['mini', 'path', 'link', 'borders', 'reckon', 'tangle'])
          expect(gold(t, r)).toBe('');
    });
  });
  describe('WHEN a card asks for its played state', () => {
    it('THEN a gold result carries its reason, and a plain one has no gold field', () => {
      const doc = { v: 1 as const, done: { a: { c: 10, p: 1000 }, b: { c: 7, p: 650 } } };
      expect(playedState('borders', 'a', doc)).toEqual({
        done: true,
        lost: false,
        text: '1000 points · 10/10',
        gold: 'A perfect ten',
      });
      expect(playedState('borders', 'b', doc)).toEqual({
        done: true,
        lost: false,
        text: '650 points · 7/10',
      });
    });
  });
});
