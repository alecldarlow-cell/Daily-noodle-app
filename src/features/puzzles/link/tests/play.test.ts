import { createSaveStore, londonDay } from '@noodle/core';

import { commitFinish, isRanked, readStreak, reopenInfo } from '../finishing';
import { afterFinish, allTiles, apply, init, SAVE_KEY, STREAK_KEY, type Move } from '../model';
import { moves, realMove, scenario, startAt, VARIANTS } from '../oracle';
import { memoryKV, simulate } from '../simulate';
import { link78 } from './fixtures';

const DATE = '2026-10-25';
const NOW = Date.parse('2026-10-25T08:30:00Z');

function won(ranked = true) {
  let s = init(link78, allTiles(link78), { ranked, rec: null });
  for (const g of link78.groups) {
    s = [...g.members.map((w): Move => ({ t: 'tile', w })), { t: 'submit' } as Move].reduce(
      apply,
      s,
    );
    s = apply(s, { t: 'land' });
  }
  return s;
}

describe('GIVEN the oracle’s variants', () => {
  it.each(VARIANTS)('THEN %s ends with the board over, every gap a whole 100 ms', (v) => {
    const steps = moves(link78, v);
    expect(steps.length).toBeGreaterThan(10);
    expect(steps.every((s) => s.ms % 100 === 0)).toBe(true);
    expect(steps.filter((s) => s.settles).every((s) => s.ms > 1080)).toBe(true);
  });

  it('THEN a midnight start puts London midnight inside the play', () => {
    const sc = scenario(link78, 'wrong', DATE);
    const t = startAt(sc, DATE, 1200);
    const end = t + 1200 + sc.steps.reduce((n, s) => n + s.ms, 0);
    expect(londonDay(t)).toBe(DATE);
    expect(londonDay(end)).toBe('2026-10-26');
    expect(startAt(scenario(link78, 'solve', DATE), DATE, 1200)).toBe(
      Date.parse(`${DATE}T08:15:00Z`),
    );
  });

  it('THEN Shuffle and Play again take the order the board was dealt', () => {
    expect(realMove({ t: 'shuffle' }, ['A'])).toEqual({ t: 'shuffle', order: ['A'] });
    expect(realMove({ t: 'again' }, ['B'])).toEqual({ t: 'again', order: ['B'] });
    expect(realMove({ t: 'play' }, [])).toEqual({ t: 'play' });
  });
});

describe('GIVEN a Link just won', () => {
  describe('WHEN it is today’s first go', () => {
    it('THEN the record and streak are saved, and the sheet has its line', () => {
      const kv = memoryKV({
        [STREAK_KEY]: { last: '2026-10-24', streak: 3, best: 3, dates: ['2026-10-24'], tz: 'L' },
      });
      const saves = createSaveStore(kv, { now: () => NOW });
      const s = won(isRanked(kv, NOW));
      const f = commitFinish(s, '01:05', saves, kv, NOW);
      expect(f).toMatchObject({
        first: true,
        ranked: true,
        stillRanked: false,
        title: 'Linked',
        time: '1:05',
        streak: 4,
        best: 4,
      });
      expect(f.share).toBe('🔗 Link #78 — 🟩🟦🟨⬛ · 1:05 · 🔥4');
      expect(f.note).toBe('All four groups, no mistakes.');
      expect(JSON.parse(kv.getItem(SAVE_KEY)!).done['DP·LINK·0078']).toEqual({
        o: 'win',
        t: '01:05',
        m: 0,
        r: [1, 2, 3, 4],
        g: [
          [1, 1, 1, 1],
          [2, 2, 2, 2],
          [3, 3, 3, 3],
          [4, 4, 4, 4],
        ],
        d: '2026-10-25',
      });
      expect(afterFinish(s, f)).toMatchObject({ hasRecord: true, ranked: false, endRanked: true });
    });
  });

  describe('WHEN today’s result is already in', () => {
    it('THEN the first record is kept, the streak is not touched, and it is not a first finish', () => {
      const streak = { last: DATE, streak: 2, best: 5, dates: [DATE], tz: 'L' };
      const kv = memoryKV({
        [SAVE_KEY]: {
          v: 1,
          done: {
            'DP·LINK·0078': { o: 'loss', t: '00:40', m: 4, r: [1, 2, 3, 4], g: [], d: DATE },
          },
        },
        [STREAK_KEY]: streak,
      });
      const saves = createSaveStore(kv, { now: () => NOW });
      expect(isRanked(kv, NOW)).toBe(false);
      const f = commitFinish(won(false), '00:30', saves, kv, NOW);
      expect(f).toMatchObject({ first: false, ranked: false, streak: 2, best: 5 });
      expect(f.rec).toMatchObject({ o: 'loss' });
      expect(readStreak(kv)).toEqual(streak);
    });
  });

  describe('WHEN the streak already has today but the page still thought it ranked (another tab)', () => {
    it('THEN nothing is recorded twice and it stays ranked', () => {
      const kv = memoryKV({
        [STREAK_KEY]: { last: DATE, streak: 1, best: 1, dates: [DATE], tz: 'L' },
      });
      const f = commitFinish(won(true), '00:30', createSaveStore(kv), kv, NOW);
      expect(f).toMatchObject({ ranked: true, stillRanked: true, streak: 1 });
    });
  });
});

describe('GIVEN a finished Link reopened', () => {
  it('THEN it shows the saved result with today’s streak', () => {
    const kv = memoryKV({ [STREAK_KEY]: { last: DATE, streak: 6, best: 9, dates: [DATE] } });
    const p = init(link78, [], { ranked: true, rec: null }).p;
    const r = reopenInfo(
      p,
      {
        o: 'win',
        t: '02:14',
        m: 1,
        r: [1, 2, 3, 4],
        g: [
          [1, 1, 1, 1],
          [2, 2, 3, 2],
          [2, 2, 2, 2],
          [3, 3, 3, 3],
          [4, 4, 4, 4],
        ],
      },
      kv,
    );
    expect(r).toMatchObject({
      won: true,
      time: '2:14',
      streak: 6,
      best: 9,
      squares: [1, 0, 2, 3, 4],
    });
    expect(r.share).toBe('🔗 Link #78 — 🟩❌🟦🟨⬛ · 2:14 · 🔥6');
    const lost = reopenInfo(p, { o: 'loss', t: 'x', g: 'nothing' }, memoryKV());
    expect(lost).toMatchObject({
      won: false,
      title: 'So close.',
      time: '0:00',
      squares: [],
      streak: 0,
    });
    expect(lost.share).toBe('🔗 Link #78 — ');
  });
});

describe('GIVEN the native half of the replay', () => {
  it.each(VARIANTS)('THEN %s plays to its finish on the fake clock', (v) => {
    const sc = scenario(link78, v, DATE);
    const t = startAt(sc, DATE, 1200);
    const deals = [
      allTiles(link78),
      ...sc.steps.map(() => (live: string[]) => live.slice().reverse()),
    ];
    const sim = simulate(link78, sc, t + 1200, DATE, deals, t);
    expect(sim.snaps).toHaveLength(sc.steps.length);
    expect(sim.snaps.at(-1)).toMatchObject({ sheet: true, share: true, tiles: '' });
    expect(sim.final.ends).toHaveLength(1);
    expect(sim.final.sheets.length).toBe(v === 'loss' ? 2 : 1);
    expect(sim.final.sheets[0]!.kick).toBe('Link 78, Sunday 25 October');
    if (v === 'loss') {
      expect(sim.final.sheets[0]!.again).toBe(true);
      expect(sim.final.save).toMatchObject({ done: { 'DP·LINK·0078': { o: 'loss', m: 4 } } });
      expect(sim.final.streak).toMatchObject({ streak: 0 });
    }
    if (v === 'replayday') expect(sim.final.streak).toEqual(sc.seed['digi-link-streak']);
    if (sc.reopen) expect(sim.reopened).not.toBeNull();
  });

  it('THEN it refuses to run without the deals its moves need', () => {
    const sc = scenario(link78, 'solve', DATE);
    expect(() => simulate(link78, sc, NOW, DATE, [allTiles(link78)])).toThrow(/fewer deals/);
  });
});
