import { apply, init } from '../model';
import { moves, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import { mini105 } from './fixtures';

const T0 = Date.parse('2026-10-24T08:15:01.700Z');

describe('GIVEN the oracle', () => {
  describe.each(VARIANTS)('WHEN it plays the %s variant', (variant) => {
    it('THEN its moves solve the puzzle, the same way every time', () => {
      const steps = moves(mini105, variant);
      expect(steps).toEqual(moves(mini105, variant));
      const end = steps.reduce((s, x) => apply(s, x.move), init(mini105));
      expect(end.solved).toBe(true);
      expect(steps.at(-1)!.ms).toBe(4000);
    });
  });

  it('THEN the variants use the help they are named for', () => {
    const kinds = (v: (typeof VARIANTS)[number]) => new Set(moves(mini105, v).map((s) => s.move.t));
    for (const k of ['step', 'key', 'checkWord', 'del', 'bar', 'checkAll'])
      expect(kinds('words')).toContain(k);
    expect(kinds('reveal').has('revealWord')).toBe(true);
    expect(kinds('checks')).toEqual(
      new Set(['cell', 'key', 'checkAll', 'checkWord', 'revealWord']),
    );
  });
});

describe('GIVEN a scenario simulated on a fake clock', () => {
  describe('WHEN the puzzle is solved square by square from a fresh save', () => {
    const sc = scenario(mini105, 'solve', '2026-10-24');
    const sim = simulate(mini105, sc, T0, '2026-10-24');

    it('THEN the board matches move by move and the clock ran from the first letter', () => {
      expect(sim.snaps).toHaveLength(sc.steps.length);
      expect(sim.snaps[0]!.timer).toBe('00:00'); // a tap, no letter yet
      expect(sim.snaps.at(-1)!.win).toBe(true);
    });

    it('THEN the save, streak, detail and share line are the web’s', () => {
      const secs = (sim.final.end as { secs: number }).secs;
      expect(sim.final.save).toEqual({
        v: 1,
        done: { 'DP·MINI·0105': { s: secs, d: '2026-10-24' } },
      });
      expect(sim.final.streak).toEqual({
        last: '2026-10-24',
        streak: 1,
        best: 1,
        dates: ['2026-10-24'],
        tz: 'L',
      });
      expect(sim.final.share).toMatch(/^✏️ Mini #105 — \d:\d\d$/);
      expect(sim.final.note).toBe('No checks, no reveals.');
      expect(sim.final.kick).toBe('Mini 105');
      expect(sim.final.stats).toEqual(['1', '1', '1']);
    });

    it('THEN the reopened sheet keeps the time and drops the note', () => {
      expect(sim.reopened).toEqual({
        share: sim.final.share,
        note: '',
        hero: sim.final.hero,
        stats: ['1', '1', '1'],
        streakLine: '🔥 1-day streak',
      });
    });
  });

  describe('WHEN it is played across London midnight with a streak from the puzzle’s day', () => {
    it('THEN it is filed under the next day and the streak goes on', () => {
      const sc = scenario(mini105, 'words', '2026-10-24');
      const t = startAt(sc, '2026-10-24', 1700);
      expect(new Date(t).toISOString() < '2026-10-24T23:00:00.000Z').toBe(true); // BST: midnight is 23:00Z
      const sim = simulate(mini105, sc, t + 1700, '2026-10-24');
      const save = sim.final.save as { done: Record<string, { d: string }> };
      expect(save.done['DP·MINI·0105']!.d).toBe('2026-10-25');
      expect(Object.keys(save.done)).toHaveLength(2);
      expect(sim.final.streak).toMatchObject({ last: '2026-10-25', streak: 5, best: 6 });
      expect(sim.final.share).toMatch(/ · 🔥5$/);
      expect(sim.final.note).toMatch(/^Two checks, no reveals\.$/);
    });
  });

  describe('WHEN an old streak without the London mark has a day’s gap', () => {
    it('THEN the grace day carries it on', () => {
      const sim = simulate(mini105, scenario(mini105, 'reveal', '2026-10-24'), T0, '2026-10-24');
      expect(sim.final.streak).toMatchObject({ streak: 3, tz: 'L' });
      expect(sim.final.end).toMatchObject({ reveals: 1, checks: 1 });
    });
  });

  describe('WHEN the streak had lapsed', () => {
    it('THEN it starts again at one and keeps the best', () => {
      const sim = simulate(mini105, scenario(mini105, 'checks', '2026-10-24'), T0, '2026-10-24');
      expect(sim.final.streak).toMatchObject({ streak: 1, best: 9 });
      expect(sim.final.share).not.toMatch(/🔥/);
    });
  });
});
