import { createSaveStore } from '@noodle/core';

import { commitFinish, endDetail, readSave, saveHost, sheetInfo } from '../finishing';
import { apply, init, SAVE_KEY } from '../model';
import { moves, scenario, startAt, VARIANTS } from '../oracle';
import { memoryKV, Session, simulate } from '../simulate';
import { reckon2 } from './fixtures';

const DAY = '2026-10-21';

describe('GIVEN the oracle', () => {
  describe.each(VARIANTS)('WHEN it plays the %s variant', (variant) => {
    it('THEN it finishes the ten, the same way every time', () => {
      const steps = moves(reckon2, variant);
      expect(steps).toEqual(moves(reckon2, variant));
      expect(steps.at(-1)!.ms).toBe(3000);
      const sc = scenario(reckon2, variant, DAY);
      const sim = simulate(reckon2, sc, startAt(sc, DAY, 1700), 2, 1700);
      expect(sim.snaps).toHaveLength(steps.length);
      expect(sim.final.end).toMatchObject({ type: 'quiz-reckon', outcome: 'scored', tv: 3 });
    });
  });

  it('THEN the variants use the controls they are named for', () => {
    const kinds = (v: (typeof VARIANTS)[number]) => new Set(moves(reckon2, v).map((s) => s.move.t));
    for (const k of ['nudge', 'reload', 'nav', 'pip', 'pause', 'resume', 'quit'])
      expect(kinds('resume')).toContain(k);
    expect(moves(reckon2, 'resume').some((s) => s.move.t === 'nudge' && s.move.hold)).toBe(true);
  });
});

describe('GIVEN a Reckon simulated on a fake clock', () => {
  describe('WHEN it is played on its own day from a fresh save (the site’s own play)', () => {
    const sc = scenario(reckon2, 'site', DAY);
    const sim = simulate(reckon2, sc, startAt(sc, DAY, 1700), 2, 1700);

    it('THEN it scores eight bullseyes and two misses, saved with its day, streak 1', () => {
      const save = sim.final.save as Record<string, unknown> & { done: Record<string, unknown> };
      expect(save.done[reckon2.id]).toMatchObject({
        p: 800,
        b: 8,
        z: [0, 0, 4, 0, 0, 4, 0, 0, 0, 0],
        d: DAY,
      });
      expect(save).toMatchObject({
        streak: { last: DAY, n: 1, best: 1 },
        best: 800,
        cur: null,
        tip: 1,
      });
      expect(sim.final.share).toBe('🎯 Reckon #2 — 🎯🎯⬜🎯🎯⬜🎯🎯🎯🎯 · 800 pts');
      expect(sim.final.hero).toBe('800pts');
      expect(sim.final.kick).toBe('Reckon 2');
      expect(sim.final.end).toMatchObject({
        score: 800,
        bulls: 8,
        zones: '0040040000',
        checks: 0,
        hints: 0,
      });
      expect(sim.final.rows).toHaveLength(10);
    });

    it('THEN the reopened sheet is the same result', () => {
      expect(sim.reopened).toEqual({
        share: sim.final.share,
        note: sim.final.note,
        hero: sim.final.hero,
        stats: sim.final.stats,
        streakLine: sim.final.streakLine,
        rows: sim.final.rows,
      });
    });
  });

  describe('WHEN it is finished after midnight, from a streak on the puzzle’s day', () => {
    it('THEN it is filed under the next day and the streak doesn’t move (own day only)', () => {
      const sc = scenario(reckon2, 'resume', DAY);
      const sim = simulate(reckon2, sc, startAt(sc, DAY, 1700), 2, 1700);
      const save = sim.final.save as {
        done: Record<string, { d: string }>;
        streak: unknown;
        snd: boolean;
      };
      expect(save.done[reckon2.id]!.d).toBe('2026-10-22');
      expect(save.streak).toEqual({ last: DAY, n: 4, best: 6 });
      expect(save.snd).toBe(false); // settings kept as found
      expect(sim.final.share).toMatch(/ · 🔥4$/);
      const reloads = sim.snaps.filter((s) => s.saved !== undefined);
      expect(reloads).toHaveLength(2);
      expect((reloads[1]!.saved as { cur: { i: number } }).cur.i).toBe(2);
    });
  });

  describe('WHEN it is played days later', () => {
    it('THEN the streak is left as it was, but still shown while alive', () => {
      const sc = scenario(reckon2, 'archive', DAY);
      const sim = simulate(reckon2, sc, startAt(sc, DAY, 1700), 2, 1700);
      expect((sim.final.save as { streak: unknown }).streak).toEqual({
        last: '2026-10-23',
        n: 3,
        best: 3,
      });
      expect(sim.final.stats[1]).toBe('3');
    });
  });

  describe('WHEN the streak had lapsed', () => {
    it('THEN it starts again at one and keeps its best', () => {
      const sc = scenario(reckon2, 'lapsed', DAY);
      const sim = simulate(reckon2, sc, startAt(sc, DAY, 1700), 2, 1700);
      expect((sim.final.save as { streak: unknown }).streak).toEqual({ last: DAY, n: 1, best: 9 });
      expect(sim.final.stats[2]).toBe('925');
    });
  });
});

describe('GIVEN the finish', () => {
  it('THEN a result kept from before stands, and the tracker reads what the sheet shows', () => {
    const kept = {
      p: 100,
      b: 1,
      z: [0, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      g: [],
      secs: 9,
      d: '2026-10-20',
    };
    const kv = memoryKV({ [SAVE_KEY]: { v: 1, done: {} } });
    const saves = createSaveStore(kv, { now: () => Date.parse(`${DAY}T09:00:00Z`) });
    const host = saveHost(
      saves,
      reckon2.id,
      () => 0,
      () => DAY,
    );
    let s = apply(init(reckon2, readSave(kv), 0), { t: 'play' }, host);
    kv.setItem(SAVE_KEY, JSON.stringify({ v: 1, done: { [reckon2.id]: kept } })); // another tab
    for (let i = 0; i < 10; i++) {
      s = apply(s, { t: 'act' }, { ...host, now: () => i * 1000 });
      s = apply(s, { t: 'act' }, { ...host, now: () => i * 1000 + 600 });
    }
    const f = commitFinish(s, saves, host);
    expect(f.rec).toEqual(kept);
    expect(f.state.view).toBe('winModal');
    expect(f.detail).toMatchObject({ secs: 9, score: 100, bulls: 1, zones: '0444444444' });
    expect(endDetail({ ...sheetInfo(f.state, { ...kept, z: [] }, DAY) }).zones).toBeNull();
  });

  it('THEN an unreadable save reads as none', () => {
    expect(readSave({ getItem: () => '{x', setItem: () => {} })).toBeNull();
  });

  it('THEN a session that is reopened after the finish shows the sheet', () => {
    const ses = new Session(reckon2, {}, Date.parse(`${DAY}T08:15:00Z`), 0);
    expect(ses.reopened()).toBeNull();
  });
});
