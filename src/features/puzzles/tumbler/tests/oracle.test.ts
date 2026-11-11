import { apply, init, validate } from '../model';
import { kept, moves, nonWord, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import { tumbler25 } from './fixtures';

describe('GIVEN the replay’s move lists', () => {
  it.each(VARIANTS)('WHEN %s is played THEN it ends solved and the native side finishes', (v) => {
    const sc = scenario(tumbler25, v, '2026-11-11');
    const t = startAt(sc, '2026-11-11', 1700);
    const r = simulate(tumbler25, sc, t, t + 1200, t + 1700);
    expect(r.snaps).toHaveLength(sc.steps.length);
    expect(r.snaps.at(-1)!.sheet).toBe(true);
    expect(r.final.end.outcome).toBe('solved');
    expect(r.final.kick).toBe('Tumbler 25');
    expect(!!r.reopened).toBe(sc.reopen);
  });
  it('THEN the lists are the same every time, and tries holds a non-word and a repeat', () => {
    expect(moves(tumbler25, 'tries')).toEqual(moves(tumbler25, 'tries'));
    const s = init(tumbler25);
    const msgs: string[] = [];
    let x = s;
    for (const st of moves(tumbler25, 'tries')) {
      x = apply(x, st.move);
      msgs.push(x.msg);
    }
    expect(msgs.some((m) => m.includes('isn’t a word'))).toBe(true);
    expect(msgs.some((m) => m.includes('already'))).toBe(true);
  });
  it('THEN a kept board starts from turned wheels and one word', () => {
    expect(kept(tumbler25)).toEqual({ o: [5, 0, 6, 0], w: ['auto'], t: 3 });
    expect(nonWord(tumbler25)).toBe('rbmu');
    expect(nonWord({ ...tumbler25, n: 3 })).toBeNull();
  });
  it('THEN a midnight start is timed to cross into the next day', () => {
    const sc = scenario(tumbler25, 'tries', '2026-11-11');
    expect(new Date(startAt(sc, '2026-11-11', 1700)).toISOString().slice(0, 10)).toBe('2026-11-11');
    expect(validate(tumbler25).ok).toBe(true);
  });
});
