import { londonDay } from '@noodle/core';

import type { Rect } from '../model';
import { findPath, LOAD_MS, moves, scenario, shortest, VARIANTS, type OracleMove } from '../oracle';
import { FakeClock, simulate, type Gesture } from '../simulate';
import { tangle19 } from './fixtures';

const RECTS: Rect[] = Array.from({ length: 16 }, (_, i) => ({
  left: 16 + (i % 4) * 91.5,
  top: 472 + Math.floor(i / 4) * 91.5,
  width: 83.5,
  height: 83.5,
}));
const centre = (i: number): [number, number] => [RECTS[i]!.left + 41.75, RECTS[i]!.top + 41.75];

/** The gestures the replay would read from the page, for a board laid out like the phone's. */
function gestures(steps: { move: OracleMove }[]): Gesture[] {
  const out: Gesture[] = [];
  for (const { move: m } of steps) {
    if (m.t === 'tap') {
      const [x, y] = centre(m.i);
      out.push({
        rects: RECTS,
        points: [
          [x, y],
          [x + 1.5, y - 1],
          [x + 2, y + 1],
        ],
      });
    } else if (m.t === 'trace') out.push({ rects: RECTS, points: m.tiles.map(centre) });
  }
  return out;
}

describe('GIVEN the oracle', () => {
  it('THEN it finds the engine’s first path for a word, or none', () => {
    expect(findPath(tangle19, 'original')).toEqual(tangle19.starPath);
    expect(findPath(tangle19, 'zzz')).toBeNull();
    expect(shortest(tangle19, 3)).toEqual(['ago', 'air', 'fig']);
  });

  it.each(VARIANTS)('THEN %s keeps every move 50 ms off the page’s tick', (v) => {
    const sc = scenario(tangle19, v);
    let t = LOAD_MS;
    let boot = 0;
    for (const s of sc.steps) {
      expect((t - boot) % 100).toBe(50);
      if (s.move.t === 'leave') boot = t;
      t += s.ms;
    }
    expect(moves(tangle19, v)).toEqual(sc.steps);
  });

  it('THEN the midnight round straddles London midnight and the archive one is three days late', () => {
    const m = scenario(tangle19, 'midnight');
    expect(londonDay(m.open)).toBe('2026-10-25');
    expect(londonDay(m.open + 100_000)).toBe('2026-10-26');
    expect(londonDay(scenario(tangle19, 'archive').open)).toBe('2026-10-28');
  });
});

describe('GIVEN the fake clock', () => {
  it('THEN timers fire in time order, ties in the order they were set, and cleared ones never', () => {
    const c = new FakeClock(0);
    const seen: string[] = [];
    c.setTimeout(() => seen.push('b'), 200);
    c.setTimeout(() => seen.push('a'), 100);
    const x = c.setTimeout(() => seen.push('x'), 150);
    c.setTimeout(() => seen.push('c'), 200);
    c.clearTimeout(x);
    c.clearTimeout(null);
    const iv = c.setInterval(() => seen.push('i'), 120);
    c.runTo(250);
    c.clearTimeout(iv);
    c.runTo(1000);
    expect(seen).toEqual(['a', 'i', 'b', 'c', 'i']);
    expect(c.now).toBe(1000);
  });
});

describe('GIVEN the native half of the replay', () => {
  it.each(VARIANTS)('THEN %s plays its round to the result', (v) => {
    const sc = scenario(tangle19, v);
    const sim = simulate(tangle19, sc, gestures(sc.steps));
    expect(sim.snaps).toHaveLength(sc.steps.length);
    expect(sim.snaps.at(-1)!.view).toBe('winModal');
    expect(sim.ends).toHaveLength(1);
    expect(sim.ends[0]).toMatchObject({ type: 'word-tangle', outcome: 'scored', secs: 90 });
    expect(sim.sheet).toMatchObject({ title: 'Time’s up', time: '1:30' });
    if (sc.reopen) expect(sim.reopened).toMatchObject({ title: 'Your score' });
    const save = sim.snaps.at(-1)!.save as { done: Record<string, { d: string }>; streak: unknown };
    const day = save.done['DP·TANG·0019']!.d;
    if (v === 'midnight') expect(day).toBe('2026-10-26');
    if (v === 'archive') expect(day).toBe('2026-10-28');
    if (v === 'mixed') expect(save.streak).toEqual({ last: '2026-10-25', n: 4, best: 4 });
    if (v === 'midnight') expect(save.streak).toMatchObject({ last: '2026-10-24', n: 2 });
  });

  it('THEN the resumed round holds its clock on the home card and across the reload', () => {
    const sc = scenario(tangle19, 'resume');
    const sim = simulate(tangle19, sc, gestures(sc.steps));
    const home = sim.snaps.findIndex((s) => s.view === 'home');
    expect(sim.snaps[home]!.home).toMatchObject({ head: 'Round paused', go: 'Resume' });
    const reopened = sc.steps.findIndex((s) => s.move.t === 'leave');
    expect(sim.snaps[reopened]!.home).toMatchObject({ head: 'Round paused' });
  });

  it('THEN it refuses to run without the gestures its moves need', () => {
    const sc = scenario(tangle19, 'words');
    expect(() => simulate(tangle19, sc, [])).toThrow(/fewer gestures/);
  });
});
