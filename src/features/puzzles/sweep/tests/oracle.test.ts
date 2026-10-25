import { createSaveStore } from '@noodle/core';

import { commitFinish, isRanked, reopenInfo } from '../finishing';
import { apply, init, restore, WRONG_FLAG } from '../model';
import { holdOf, moves, PRESS_HOLD_MS, scenario, startAt, VARIANTS } from '../oracle';
import { memoryKV, simulate } from '../simulate';
import { sweep94 } from './fixtures';

const DATE = '2026-10-18';
const lead = { load: 1200, play: 500 };
function sim(variant: (typeof VARIANTS)[number]) {
  const sc = scenario(sweep94, variant, DATE);
  const t = startAt(sc, DATE, lead.load + lead.play);
  return { sc, t, out: simulate(sweep94, sc, t, t + lead.load + lead.play, DATE, 94) };
}

describe('GIVEN the oracle', () => {
  describe.each(VARIANTS)('WHEN it plays the %s variant', (variant) => {
    it('THEN its moves sweep the board, the same way every time', () => {
      const steps = moves(sweep94, variant);
      expect(steps).toEqual(moves(sweep94, variant));
      const end = steps.reduce(
        (s, x) => apply(s, x.move, { ranked: false }),
        init(sweep94, { ranked: true }),
      );
      expect(end.won).toBe(true);
      expect(steps.at(-1)!.ms).toBe(4000);
    });
  });

  it('THEN the variants use the controls they are named for', () => {
    const kinds = (v: (typeof VARIANTS)[number]) => new Set(moves(sweep94, v).map((s) => s.move.t));
    expect(kinds('solve')).toEqual(new Set(['tap']));
    expect(kinds('boom')).toEqual(new Set(['tap', 'hint', 'again', 'press', 'mode']));
    expect(kinds('hint')).toContain('hint');
    expect(kinds('wrongflag')).toContain('press');
    expect(kinds('flags')).toEqual(new Set(['tap', 'mode', 'press']));
    expect(holdOf({ t: 'press', i: 0 })).toBe(PRESS_HOLD_MS);
    expect(holdOf({ t: 'hint' })).toBe(0);
  });
});

describe('GIVEN a scenario simulated on a fake clock', () => {
  describe('WHEN the board is dug square by square from a fresh save', () => {
    const { out } = sim('solve');
    it('THEN the clock waited for the start square and the sheet rose after the sweep', () => {
      expect(out.snaps[0]!.timer).toBe('00:00');
      expect(out.snaps[0]!.cells).not.toMatch(/L/);
      expect(out.snaps.at(-1)).toMatchObject({ win: true, sheet: true });
    });
    it('THEN the save, streak, detail and share line are the web’s', () => {
      const secs = (out.final.end as { secs: number }).secs;
      expect(out.final.save).toEqual({
        v: 1,
        done: { 'DP·SWEEP·2026-10-18': { o: 'win', s: secs, d: DATE } },
      });
      expect(out.final.streak).toEqual({
        last: DATE,
        streak: 1,
        best: 1,
        dates: [DATE],
        tz: 'L',
      });
      expect(out.final.share).toMatch(/^💣 Sweep 18 Oct — swept in \d:\d\d$/);
      expect(out.final).toMatchObject({
        title: 'Swept',
        note: 'All seven mines found, no hints.',
        kick: 'Sweep 94, Sunday 18 October',
        stats: ['1', '1', '1'],
        again: false,
        round: 1,
      });
      expect(out.reopened).toMatchObject({
        note: 'All seven mines found.',
        stats: ['1', '1', '1'],
      });
    });
  });

  describe('WHEN a mine is hit with a live streak, then the board replayed', () => {
    const { out } = sim('boom');
    it('THEN the loss is kept, the streak reset, and the replay records nothing', () => {
      expect(out.final.end).toMatchObject({ outcome: 'failed', hints: 1 });
      const save = out.final.save as { done: Record<string, { o: string; b: number }> };
      expect(save.done['DP·SWEEP·2026-10-18']).toMatchObject({ o: 'loss', b: 2 });
      expect(out.final.streak).toMatchObject({ streak: 0, best: 6, last: DATE });
      expect(out.final).toMatchObject({ title: 'Swept', round: 2, stats: ['0', '6', '2'] });
      expect(out.final.share).toMatch(/^💣 Sweep 18 Oct — swept in \d:\d\d$/);
      expect(out.snaps.some((s) => s.rank === '· replay')).toBe(true);
      expect(out.reopened).toMatchObject({
        title: 'Boom.',
        share: '💥 Sweep 18 Oct — boom',
        again: true,
      });
    });
  });

  describe('WHEN Hint is used with an old, unmarked streak', () => {
    it('THEN the grace day carries the streak on and the hints are counted', () => {
      const { out } = sim('hint');
      expect(out.final.streak).toMatchObject({ streak: 3, tz: 'L' });
      expect((out.final.end as { hints: number }).hints).toBeGreaterThan(5);
      expect(out.snaps.some((s) => s.cells.includes('!'))).toBe(true);
    });
  });

  describe('WHEN a provably wrong flag is laid with a lapsed streak', () => {
    it('THEN Hint names it and the streak starts again', () => {
      const { out } = sim('wrongflag');
      expect(out.snaps.some((s) => s.msg === WRONG_FLAG)).toBe(true);
      expect(out.final.streak).toMatchObject({ streak: 1, best: 9 });
    });
  });

  describe('WHEN today’s result is already in and play runs past midnight', () => {
    it('THEN it is a replay: filed under the next day, the streak untouched', () => {
      const { out, sc } = sim('unproved');
      const save = out.final.save as { done: Record<string, { d: string }> };
      expect(save.done['DP·SWEEP·2026-10-18']!.d).toBe('2026-10-19');
      expect(out.final.streak).toEqual(sc.seed['digi-sweep-streak']);
      expect(out.snaps[0]!.rank).toBe('· replay');
    });
  });

  describe('WHEN yesterday’s streak meets a finish after midnight', () => {
    it('THEN a day was missed and the run starts again', () => {
      const { out } = sim('flags');
      expect(out.final.streak).toMatchObject({ last: '2026-10-19', streak: 1, best: 4 });
      expect(out.snaps.some((s) => s.neg)).toBe(true);
      expect(out.snaps.some((s) => s.cells.includes('~'))).toBe(true);
      expect(out.snaps.some((s) => s.msg.startsWith('All 36 squares called'))).toBe(true);
    });
  });
});

describe('GIVEN the finish rules on their own', () => {
  it('THEN a result already in keeps the streak, and a reopened loss offers Play again', () => {
    const kv = memoryKV({
      'digi-sweep-streak': { last: DATE, streak: 2, best: 3, dates: [DATE], tz: 'L' },
    });
    const at = Date.parse(`${DATE}T10:00:00Z`);
    expect(isRanked(kv, at)).toBe(false);
    expect(isRanked(memoryKV(), at)).toBe(true);
    const saves = createSaveStore(kv, { now: () => at });
    const s = { ...apply(init(sweep94, { ranked: true }), { t: 'tap', i: 22 }), endRanked: true };
    const lost = apply(s, { t: 'tap', i: 2 }, { secs: 9 });
    const f = commitFinish(lost, saves, kv, at);
    expect(f).toMatchObject({ first: true, title: 'Boom.', streak: 2, again: true });
    const r = reopenInfo(restore(sweep94, f.rec, false)!, kv);
    expect(r).toMatchObject({ title: 'Boom.', hero: '0:09', again: true });
    expect(commitFinish(lost, saves, kv, at).first).toBe(false);
  });
});
