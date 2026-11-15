import {
  apply,
  ballAt,
  init,
  restoreDone,
  routePoints,
  shortest,
  size,
  slide,
  STILL_MSG,
  tiltNumber,
  timerText,
  turnsText,
  turnTime,
  validate,
  wallSegments,
  xy,
  type TiltData,
  type TiltState,
} from '../model';
import { route } from '../oracle';
import { tilt5 } from './fixtures';

const play = (s: TiltState, dirs: (1 | -1)[]) =>
  dirs.reduce((st, dir) => apply(st, { t: 'turn', dir }), s);

describe('GIVEN Tilt 5', () => {
  describe('WHEN its gate runs', () => {
    it('THEN it passes, with par the shortest way out', () => {
      expect(validate(tilt5)).toEqual({ ok: true, checks: [] });
      expect(shortest(tilt5)!.par).toBe(12);
    });
  });

  describe('WHEN a maze breaks the rules', () => {
    const copy = (): TiltData => JSON.parse(JSON.stringify(tilt5)) as TiltData;
    it('THEN malformed data is refused', () => {
      expect(validate(null).checks).toEqual(['malformed maze']);
      expect(validate({ ...tilt5, walls: [[1]] }).checks).toEqual(['malformed maze']);
    });
    it('THEN walls that disagree, a walled exit and a wrong par are named', () => {
      const a = copy();
      a.walls[0]![0]! ^= 2;
      expect(validate(a).checks).toContain('walls disagree');
      const b = copy();
      b.walls[9]![9]! |= 4;
      expect(validate(b).checks).toContain('the exit is walled');
      const c = copy();
      c.walls[0]![4]! &= ~1;
      expect(validate(c).checks).toContain('a gap in the outer wall');
      expect(validate({ ...copy(), par: 3 }).checks).toEqual([
        'par 3 is not the shortest way out (12)',
      ]);
    });
    it('THEN a ball with no floor is refused', () => {
      const d = copy();
      d.walls[5]![5]! &= ~4;
      d.walls[6]![5]! &= ~1;
      expect(validate(d).checks).toContain('no floor under the ball');
    });
  });

  describe('WHEN it is turned along the shortest way', () => {
    it('THEN the ball goes out in par turns, shading its trail', () => {
      const s = play(init(tilt5), route(init(tilt5)));
      expect(s.solved).toBe(true);
      expect(s.turns).toBe(12);
      expect(s.trail[0]).toBe('5,5');
      expect(new Set(s.trail).size).toBe(s.trail.length);
      // a finished maze takes no more moves
      expect(apply(s, { t: 'turn', dir: 1 })).toBe(s);
      expect(turnTime(s)).toBe(
        300 + (s.last!.path.length ? 90 + 45 * s.last!.path.length : 0) + 200,
      );
      const [x, y] = ballAt(s, true);
      expect([x, y]).not.toEqual(xy(s.pos[0], s.pos[1]));
      expect(ballAt(s, false)).toEqual(xy(s.pos[0], s.pos[1]));
    });
  });

  describe('WHEN a turn moves nothing, and Undo is used', () => {
    it('THEN it says so, and Undo puts every part back', () => {
      const s0 = init(tilt5);
      let still: TiltState | null = null;
      let s = s0;
      for (let i = 0; i < 40 && !still; i++) {
        for (const dir of [1, -1] as const) {
          const n = apply(s, { t: 'turn', dir });
          if (!n.solved && !n.last!.path.length) {
            still = n;
            break;
          }
        }
        s = apply(s, { t: 'turn', dir: route(s)[0]! });
      }
      expect(still!.msg).toBe(STILL_MSG);
      const one = apply(s0, { t: 'turn', dir: 1 });
      const back = apply(one, { t: 'undo' });
      expect(back.pos).toEqual(s0.pos);
      expect(back.turns).toBe(0);
      expect(back.rot).toBe(0);
      expect(back.trail).toEqual([]);
      expect(back.msg).toBe('');
      expect(apply(s0, { t: 'undo' })).toBe(s0);
      expect(turnTime(s0)).toBe(0);
      expect(apply(s0, { t: 'turn', dir: -1 }).rot).toBe(-1);
    });
  });

  describe('WHEN the slide meets the rim away from the gap', () => {
    it('THEN the ball stops at the edge, not out', () => {
      const s = slide(tilt5, [0, 4], 2);
      expect(s.out).toBe(false);
    });
  });
});

describe('GIVEN the drawing helpers', () => {
  it('THEN sizes, walls, the route and words match the page', () => {
    expect(size(tilt5)).toBe(10 * 40 + 28);
    const w = wallSegments(tilt5);
    expect(w.rim.length).toBeGreaterThan(30);
    expect(w.inner.length).toBeGreaterThan(0);
    const pts = routePoints(tilt5);
    expect(pts[0]).toEqual(xy(5, 5));
    expect(pts.length).toBeGreaterThan(12);
    expect(turnsText(1)).toBe('1 turn');
    expect(turnsText(3)).toBe('3 turns');
    expect(timerText(65.4)).toBe('1:05');
    expect(timerText(-3)).toBe('0:00');
    expect(tiltNumber('DP·TILT·0012')).toBe(12);
    const done = restoreDone(tilt5, 9);
    expect(done).toMatchObject({ solved: true, turns: 9, pos: [5, 5], msg: '' });
  });
  it('THEN a maze with no way out has a route of just its start', () => {
    const shut = JSON.parse(JSON.stringify(tilt5)) as TiltData;
    shut.walls[9]![9]! |= 4;
    expect(shortest(shut)).toBeNull();
    expect(routePoints(shut)).toEqual([xy(5, 5)]);
  });
});
