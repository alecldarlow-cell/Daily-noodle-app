/**
 * One unfinished round per puzzle (22 Nov 2026): @noodle/core's rounds helpers against the
 * site's own dn-core.js (vendored), on seeded random saves, and the rules themselves.
 */
import { dropRound, keepRound, mergeRounds, roundFor, ROUNDS_KEPT } from '../rounds';
import { mergeProgress } from '../saves';
import { loadDnCore } from './site';
import { rng, type Rng } from './gen';

const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));
const IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function save(r: Rng): Record<string, unknown> {
  const s: Record<string, unknown> = { v: 1 };
  if (r.chance(0.9)) {
    const done: Record<string, unknown> = {};
    for (const id of IDS) if (r.chance(0.2)) done[id] = { s: r.int(0, 99) };
    s.done = done;
  }
  if (r.chance(0.7)) {
    const rounds: Record<string, unknown> = {};
    for (const id of IDS)
      if (r.chance(0.5))
        rounds[id] = r.chance(0.95)
          ? { id, n: r.int(0, 9), ...(r.chance(0.85) ? { at: r.int(0, 100) } : {}) }
          : 'x';
    s.rounds = rounds;
  }
  if (r.chance(0.5)) s.cur = r.chance(0.8) ? { id: r.pick(IDS), n: r.int(0, 9) } : null;
  return s;
}

describe('GIVEN 2,000 random saves', () => {
  const site = loadDnCore();
  const r = rng(22);
  it('THEN roundFor, keepRound, dropRound, mergeRounds and mergeProgress match dn-core.js', () => {
    for (let i = 0; i < 2000; i++) {
      const a = save(r);
      const b = save(r);
      const id = r.pick(IDS);
      const now = r.int(0, 120);
      expect(clone(roundFor(clone(a), id))).toEqual(clone(site.roundFor(clone(a), id)));
      const round = { id, n: r.int(0, 9) };
      expect(keepRound(clone(a), clone(round), now)).toEqual(
        clone(site.keepRound(clone(a), clone(round), now)),
      );
      expect(dropRound(clone(a), id)).toEqual(clone(site.dropRound(clone(a), id)));
      const active = r.chance(0.7) ? id : undefined;
      expect(mergeRounds(clone(a.rounds), clone(b.rounds), clone(a.done), active)).toEqual(
        clone(site.mergeRounds(clone(a.rounds), clone(b.rounds), clone(a.done), active)),
      );
      expect(mergeProgress(clone(a), clone(b), active)).toEqual(
        clone(site.mergeProgress(clone(a), clone(b), active)),
      );
    }
  });
});

describe('GIVEN Tally 25 part-played', () => {
  describe('WHEN Tally 29 is started', () => {
    it('THEN both rounds are kept, each read back as its own, and cur holds the latest', () => {
      const s: Record<string, unknown> = { v: 1, done: {} };
      keepRound(s, { id: 'T25', g: [1] }, 1000);
      keepRound(s, { id: 'T29', g: [2] }, 2000);
      expect(roundFor(s, 'T25')).toEqual({ id: 'T25', g: [1], at: 1000 });
      expect(roundFor(s, 'T29')).toEqual({ id: 'T29', g: [2], at: 2000 });
      expect((s.cur as { id: string }).id).toBe('T29');
    });
  });
  describe('WHEN Tally 25 is finished', () => {
    it('THEN only its round goes, and the key goes with the last one', () => {
      const s: Record<string, unknown> = { v: 1, done: {} };
      keepRound(s, { id: 'T25' }, 1);
      keepRound(s, { id: 'T29' }, 2);
      dropRound(s, 'T25');
      expect(Object.keys(s.rounds as object)).toEqual(['T29']);
      dropRound(s, 'T29');
      expect('rounds' in s).toBe(false);
    });
  });
});

describe('GIVEN more rounds than are kept', () => {
  it('THEN the newest ten stay, and the one being kept always does', () => {
    const s: Record<string, unknown> = { v: 1, done: {} };
    for (let i = 1; i <= 12; i++) keepRound(s, { id: `P${i}` }, i * 10);
    expect(Object.keys(s.rounds as object)).toHaveLength(ROUNDS_KEPT);
    expect((s.rounds as Record<string, unknown>).P1).toBeUndefined();
    keepRound(s, { id: 'OLD' }, 1);
    expect((s.rounds as Record<string, unknown>).OLD).toBeDefined();
  });
});

describe('GIVEN a save from before rounds', () => {
  it('THEN cur resumes its own puzzle only, and a finished one none', () => {
    expect(roundFor({ v: 1, cur: { id: 'A' } }, 'A')).toEqual({ id: 'A' });
    expect(roundFor({ v: 1, cur: { id: 'A' } }, 'B')).toBeNull();
    expect(roundFor({ v: 1, done: { A: 1 }, cur: { id: 'A' } }, 'A')).toBeNull();
    expect(roundFor(null, 'A')).toBeNull();
  });
});
