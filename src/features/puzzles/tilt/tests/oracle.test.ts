import { londonDay } from '@noodle/core';

import { apply, init } from '../model';
import { kept, moves, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import { tilt5 } from './fixtures';

const DATE = '2026-11-01';

describe.each(VARIANTS)('GIVEN the %s moves', (variant) => {
  const sc = scenario(tilt5, variant, DATE);
  it('THEN they get the ball out', () => {
    const start = variant === 'resume' ? kept(tilt5) : init(tilt5);
    const s = sc.steps.reduce((a, st) => apply(a, st.move), start);
    expect(s.solved).toBe(true);
  });
  it('WHEN simulated THEN there is a snapshot a move, a result, and the sheet last', () => {
    const t = startAt(sc, DATE, 1700);
    const r = simulate(tilt5, sc, t, t + 1200, t + 1700);
    expect(r.snaps).toHaveLength(sc.steps.length);
    const last = r.snaps[r.snaps.length - 1]!;
    expect(last.sheet).toBe(true);
    expect(last.undoOff).toBe(true);
    expect(last.msg).toMatch(/^Out in \d+:\d\d, \d+ turns?\.$/);
    expect(r.final.share).toMatch(/^🌀 Tilt #5 — \d+:\d\d · \d+ turns?/);
    expect(r.final.title).toBe('Out');
    expect(r.final.kick).toBe('Tilt 5');
    expect(r.final.save).toMatchObject({ done: { 'DP·TILT·0005': { t: r.final.hero } } });
    expect((r.final.save as { cur?: unknown }).cur).toBeUndefined();
  });
});

describe('GIVEN each variant’s start', () => {
  it('THEN a kept maze carries its 42 seconds and says so; a midnight one keeps its streak going', () => {
    const sc = scenario(tilt5, 'resume', DATE);
    const t = startAt(sc, DATE, 1700);
    const r = simulate(tilt5, sc, t, t + 1200, t + 1700);
    expect(r.final.note).toMatch(/Picked up where you left off\.$/);
    expect(r.reopened?.note).not.toMatch(/Picked up/);
    const mid = scenario(tilt5, 'detour', DATE);
    const at = startAt(mid, DATE, 1700);
    expect(londonDay(at)).toBe(DATE);
    const d = simulate(tilt5, mid, at, at + 1200, at + 1700);
    expect(d.final.streakLine).toMatch(/5-day Tilt streak/);
    // the detour shows a turn that moved nothing, and Undo
    expect(mid.steps.some((s) => s.move.t === 'undo')).toBe(true);
    expect(d.snaps.some((s) => /Nothing moved/.test(s.msg))).toBe(true);
  });
  it('THEN moves end on a pause long enough to read the sheet', () => {
    const list = moves(tilt5, 'solve');
    expect(list[list.length - 1]!.ms).toBe(1500);
    expect(list.length).toBe(12);
  });
});
