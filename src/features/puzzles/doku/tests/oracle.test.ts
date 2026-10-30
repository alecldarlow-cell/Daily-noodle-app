import { londonDay } from '@noodle/core';

import { apply, init } from '../model';
import { moves, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import { doku104, doku97 } from './fixtures';

describe('GIVEN the replay’s oracle', () => {
  describe.each([
    ['Doku 97', doku97, '2026-10-18'],
    ['Doku 104', doku104, '2026-10-25'],
  ])('WHEN every variant plays %s', (_name, data, date) => {
    it.each(VARIANTS)('THEN %s ends solved, typing only while the keyboard is up', (v) => {
      const steps = moves(data, v);
      let s = init(data);
      for (const { move } of steps) {
        if (move.t === 'key' || move.t === 'del' || move.t === 'space') expect(s.kbd).toBe(true);
        s = apply(s, move);
      }
      expect(s.solved).toBe(true);
      expect(steps[steps.length - 1]!.ms).toBe(4000);
      expect(moves(data, v)).toEqual(steps); // deterministic
    });
  });

  it('THEN each variant uses the controls it is meant to', () => {
    const kinds = (v: (typeof VARIANTS)[number]) => new Set(moves(doku97, v).map((s) => s.move.t));
    expect(kinds('solve')).toEqual(new Set(['tile', 'cell']));
    expect(kinds('typed')).toEqual(new Set(['cell', 'key', 'del', 'space', 'tile']));
    expect(kinds('fullwrong')).toContain('hints');
    expect(kinds('hints')).toContain('hints');
    expect(kinds('seed')).toContain('key');
  });

  describe('WHEN the scenarios are built', () => {
    it('THEN they start from the saves each one is about', () => {
      const date = '2026-10-18';
      expect(scenario(doku97, 'solve', date)).toMatchObject({ seed: {}, reopen: true });
      expect(scenario(doku97, 'typed', date).seed['digi-doku-streak']).toMatchObject({
        last: date,
        tz: 'L',
      });
      expect(scenario(doku97, 'fullwrong', date).seed['digi-doku-streak']).not.toHaveProperty('tz');
      const seed = scenario(doku97, 'seed', date).seed;
      expect(seed).not.toHaveProperty('digi-doku-streak');
      expect(Object.keys((seed['digi-doku-v1'] as { done: object }).done)).toHaveLength(3);
    });

    it('THEN a midnight game is timed so London midnight falls inside it', () => {
      const sc = scenario(doku97, 'typed', '2026-10-18');
      const t = startAt(sc, '2026-10-18', 1700);
      const end = t + 1700 + sc.steps.reduce((n, s) => n + s.ms, 0);
      expect(londonDay(t)).toBe('2026-10-18');
      expect(londonDay(end)).toBe('2026-10-19');
      expect(startAt(scenario(doku97, 'solve', '2026-10-18'), '2026-10-18', 0)).toBe(
        Date.parse('2026-10-18T08:15:00Z'),
      );
    });
  });
});

describe('GIVEN the native half of the replay', () => {
  describe('WHEN the seed scenario is simulated', () => {
    it('THEN the load rebuilds the streak from the results, and the solve takes it on', () => {
      const date = '2026-10-18';
      const sc = scenario(doku97, 'seed', date);
      const sim = simulate(doku97, sc, Date.parse(`${date}T08:16:00Z`), date);
      expect(sim.opened).toMatchObject({ last: '2026-10-17', streak: 3, best: 3, seeded: 1 });
      expect(sim.final.streak).toMatchObject({ last: date, streak: 4, best: 4, seeded: 1 });
      expect(sim.final.kick).toBe('Doku 97');
      expect(sim.final.note).toBe('All twelve tiles placed.');
      expect(sim.final.stats).toEqual(['4', '4', '4']);
      expect(sim.reopened).toMatchObject({ note: '', stats: ['4', '4', '4'] });
      expect(sim.snaps).toHaveLength(sc.steps.length);
      expect(sim.snaps[sim.snaps.length - 1]).toMatchObject({
        win: true,
        kbd: expect.any(Boolean),
      });
    });
  });

  describe('WHEN a fresh player solves', () => {
    it('THEN the streak is seeded from today’s own result, as the page does', () => {
      const date = '2026-10-18';
      const sc = scenario(doku97, 'solve', date);
      const sim = simulate(doku97, sc, Date.parse(`${date}T08:16:00Z`), date);
      expect(sim.opened).toBeNull();
      expect(sim.final.streak).toEqual({
        last: date,
        streak: 1,
        best: 1,
        dates: [date],
        tz: 'L',
        seeded: 1,
      });
      expect(sim.snaps[0]!.timer).toBe('00:00');
    });
  });

  it('THEN a list that never solves is an error', () => {
    const sc = scenario(doku97, 'solve', '2026-10-18');
    expect(() => simulate(doku97, { ...sc, steps: sc.steps.slice(0, 2) }, 0, '2026-10-18')).toThrow(
      /never solved/,
    );
  });
});
