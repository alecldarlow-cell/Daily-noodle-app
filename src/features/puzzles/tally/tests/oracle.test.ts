import { londonDay } from '@noodle/core';

import { apply, init, validate } from '../model';
import { moves, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import { tally1 } from './fixtures';

const DATE = '2026-10-25';

describe.each(VARIANTS)('GIVEN the %s moves', (variant) => {
  const sc = scenario(tally1, variant, DATE);
  it('THEN they solve the board', () => {
    const start = sc.seed['digi-tally-v1'] as
      | { cur?: { g: number[]; notes: number[] } }
      | undefined;
    const s = sc.steps.reduce((a, st) => apply(a, st.move), {
      ...init(tally1),
      ...(start?.cur ? { g: start.cur.g, notes: start.cur.notes } : {}),
    });
    expect(s.solved).toBe(true);
    expect(validate(tally1).ok).toBe(true);
  });
  it('WHEN simulated THEN there is a snapshot a move, a result, and the sheet last', () => {
    const t = startAt(sc, DATE, 1700);
    const r = simulate(tally1, sc, t, t + 1200, t + 1700);
    expect(r.snaps).toHaveLength(sc.steps.length);
    expect(r.snaps[r.snaps.length - 1]!.sheet).toBe(true);
    expect(r.snaps[r.snaps.length - 1]!.msg).toMatch(/^Solved in \d+:\d\d\.$/);
    expect(r.final.share).toMatch(/^🧮 Tally #1 — \d+:\d\d/);
    expect(r.final.save).toMatchObject({ done: { 'DP·TALLY·0001': { t: r.final.hero } } });
    expect((r.final.save as { cur?: unknown }).cur).toBeUndefined();
  });
});

describe('GIVEN each variant’s start', () => {
  it('THEN a kept round carries its 42 seconds and says so, a midnight one crosses the day', () => {
    const sc = scenario(tally1, 'resume', DATE);
    const t = startAt(sc, DATE, 1700);
    const r = simulate(tally1, sc, t, t + 1200, t + 1700);
    expect(r.final.note).toBe('Picked up where you left off.');
    expect(r.reopened?.note).toBe('');
    const mid = scenario(tally1, 'notes', DATE);
    const at = startAt(mid, DATE, 1700);
    expect(londonDay(at)).toBe(DATE);
    expect(simulate(tally1, mid, at, at + 1200, at + 1700).final.streakLine).toBe(
      '🔥 5-day Tally streak',
    );
  });
  it('THEN moves end on a pause long enough to read the sheet', () => {
    const list = moves(tally1, 'solve');
    expect(list[list.length - 1]!.ms).toBe(1500);
  });
});
