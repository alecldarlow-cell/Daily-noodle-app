import { apply, init } from '../model';
import { kept, LAST_MS, moves, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import { redact5 } from './fixtures';

const DATE = '2026-11-01';

describe('GIVEN the replay’s move lists', () => {
  it.each(VARIANTS)(
    'WHEN %s is played THEN the board ends solved, the last wait past the beat',
    (v) => {
      const steps = moves(redact5, v);
      const start = v === 'resume' ? { ...init(redact5), black: kept(redact5).b } : init(redact5);
      const end = steps.reduce((s, st) => apply(s, st.move), start);
      expect(end.solved).toBe(true);
      expect(steps.at(-1)!.ms).toBe(LAST_MS);
      // deterministic
      expect(moves(redact5, v)).toEqual(steps);
    },
  );
  it('THEN the wrong variant makes a wrong try, uses Undo and Clear, and thinks once at length', () => {
    const steps = moves(redact5, 'wrong');
    expect(steps.some((s) => s.move.t === 'undo')).toBe(true);
    expect(steps.some((s) => s.move.t === 'clear')).toBe(true);
    expect(steps.some((s) => s.ms === 45_000)).toBe(true);
  });
  it.each(VARIANTS)(
    'WHEN %s is simulated THEN every move gives a snapshot and it finishes',
    (v) => {
      const sc = scenario(redact5, v, DATE);
      const open = startAt(sc, DATE, 2000);
      const out = simulate(redact5, sc, open, open + 500, open + 900);
      expect(out.snaps).toHaveLength(sc.steps.length);
      expect(out.snaps.at(-1)!.sheet).toBe(true);
      expect(out.final.title).toBe('Solved');
      expect(out.final.kick).toBe('Redact 5');
      expect(out.reopened === null).toBe(!sc.reopen);
    },
  );
  it('THEN a midnight start lands just before London’s midnight', () => {
    const sc = scenario(redact5, 'midnight', DATE);
    const t = startAt(sc, DATE, 2000);
    expect(new Date(t).toISOString() < '2026-11-02T00:00:00Z').toBe(true);
  });
});
