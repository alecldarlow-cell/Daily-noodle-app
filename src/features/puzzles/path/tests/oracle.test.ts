import { apply, init } from '../model';
import { moves, scenario, startAt, VARIANTS } from '../oracle';
import { lineCodes, simulate } from '../simulate';
import { path92 } from './fixtures';

const DATE = '2026-10-18';
function sim(variant: (typeof VARIANTS)[number]) {
  const sc = scenario(path92, variant, DATE);
  const t = startAt(sc, DATE, 1700);
  return { sc, out: simulate(path92, sc, t, t + 1200, t + 1700, DATE) };
}

describe('GIVEN the oracle', () => {
  describe.each(VARIANTS)('WHEN it plays the %s variant', (variant) => {
    it('THEN its moves complete the thread, the same way every time', () => {
      const steps = moves(path92, variant);
      expect(steps).toEqual(moves(path92, variant));
      const states = steps.reduce((a, x) => [...a, apply(a.at(-1)!, x.move)], [init(path92)]);
      expect(states.at(-1)!.solved).toBe(true);
      // nothing is pressed once the sheet covers the board
      expect(states.slice(0, -1).some((s) => s.solved)).toBe(false);
      expect(steps.at(-1)!.ms).toBe(3000);
    });
  });

  it('THEN the variants use the controls they are named for', () => {
    const kinds = (v: (typeof VARIANTS)[number]) => new Set(moves(path92, v).map((s) => s.move.t));
    expect(kinds('solve')).toEqual(new Set(['cell']));
    expect(kinds('hints')).toContain('hint');
    expect(kinds('undo')).toEqual(new Set(['cell', 'undo', 'hint']));
  });
});

describe('GIVEN a scenario simulated on a fake clock', () => {
  describe('WHEN it is solved from a fresh save', () => {
    const { out } = sim('solve');
    it('THEN the clock ran from Play and the sheet rose after the thread', () => {
      expect(out.snaps[0]!.timer).toBe('0:01'); // Play, then 0.5 s, then the first tap's 0.7 s
      expect(out.snaps[0]!.cells.split(' ')[34]).toBe('1*');
      expect(out.snaps.at(-1)).toMatchObject({ sheet: true, streak: '1' });
      expect(out.snaps.at(-1)!.lines).toHaveLength(1);
    });
    it('THEN the save, streak, detail and share line are the web’s', () => {
      const t = (out.final.save as { done: Record<string, { t: string }> }).done['DP·PATH·0092']!.t;
      expect(t).toMatch(/^\d+:\d\d$/);
      expect(out.final.streak).toEqual({ last: DATE, streak: 1, best: 1, dates: [DATE], tz: 'L' });
      expect(out.final).toMatchObject({
        share: `〰️ Path #92 — ${t}`,
        title: 'Thread complete',
        note: 'One to 36 without a hint.',
        kick: 'Path 92',
        stats: ['1', '1', '1'],
      });
      expect(out.final.end).toMatchObject({ type: 'logic-path', outcome: 'solved', hints: 0 });
      expect(out.reopened).toEqual({
        share: out.final.share,
        note: '',
        hero: t,
        stats: ['1', '1', '1'],
        streakLine: '🔥 1-day streak',
      });
    });
  });

  describe('WHEN both ends are grown across midnight with a streak from the puzzle’s day', () => {
    it('THEN it is filed under the next day and the streak goes on', () => {
      const { out } = sim('ends');
      const save = out.final.save as { done: Record<string, { d: string }> };
      expect(save.done['DP·PATH·0092']!.d).toBe('2026-10-19');
      expect(out.final.streak).toMatchObject({ last: '2026-10-19', streak: 5, best: 6 });
      expect(out.final.share).toMatch(/ · 🔥5$/);
      expect(out.final.note).toBe('One to 36 with one hint.');
      expect(out.snaps[0]!.streak).toBe('4');
      expect(out.snaps.some((s) => s.cells.includes('~'))).toBe(true);
    });
  });

  describe('WHEN Hint does much of it, with an old streak a day behind', () => {
    it('THEN Path gives no grace day: the streak starts again', () => {
      const { out } = sim('hints');
      expect(out.final.streak).toMatchObject({ streak: 1, best: 2, tz: 'L' });
      expect(out.final.note).toMatch(/^One to 36 with \w+ hints\.$/);
      expect(out.snaps[0]!.streak).toBe('0');
    });
  });

  describe('WHEN a wrong turn is undone, with a lapsed streak', () => {
    it('THEN the thread still completes and the streak restarts at one', () => {
      const { out } = sim('undo');
      expect(out.snaps.some((s) => s.msg === 'Undone.')).toBe(true);
      expect(out.final.streak).toMatchObject({ streak: 1, best: 9 });
      expect(out.final.stats).toEqual(['1', '9', '2']);
    });
  });

  it('THEN the threads are drawn as the page’s SVG holds them', () => {
    expect(lineCodes(init(path92))).toEqual([]);
    const s = apply(apply(init(path92), { t: 'cell', r: 5, c: 4 }), { t: 'cell', r: 5, c: 5 });
    expect(lineCodes(s)).toEqual(['#2E5BFF 450,550 550,550']);
  });
});
