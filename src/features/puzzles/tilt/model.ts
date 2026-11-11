/**
 * Tilt's rules, ported line by line from dailynoodle engines/tilt.js (Lab, 6 Nov 2026): a
 * 10×10 maze turned a quarter at a time; after every turn the ball drops until a wall stops
 * it, or rolls out through the gap in the outer wall. Pure TypeScript with no React or
 * storage; the screen and the differential replay (scripts/replay.js) both play it. Moves
 * are the page's controls: turn left, turn right, Undo.
 */
export const SAVE_KEY = 'digi-tilt-v1';
export const STREAK_KEY = 'digi-tilt-streak';
/** The page's message before the first turn (its markup's #msg). */
export const START_MSG = 'Turn the maze; the ball drops until it hits a wall.';
export const RESUME_MSG = 'Carrying on where you left off.';
export const STILL_MSG = 'Nothing moved: the ball was already resting that way.';
/** The engine keeps the last 300 turns for Undo. */
const UNDO_MAX = 300;

/** The page's drawing units (engines/tilt.js CS, PAD): a square and the margin round the maze. */
export const CS = 40;
export const PAD = 14;

/** The engine's timings: the maze's quarter turn, then the ball's roll, then out through the gap. */
export const TURN_MS = 300;
export const OUT_MS = 200;
export const rollMs = (cells: number) => (cells ? 90 + 45 * cells : 0);

export interface TiltData {
  type: 'tilt';
  id: string;
  band: string;
  n: number;
  /** Per square, its walls: 1 top, 2 right, 4 bottom, 8 left. */
  walls: number[][];
  start: [number, number];
  /** The gap: row, column and the side (a gravity direction) it opens on. */
  exit: [number, number, number];
  par: number;
  seed?: string;
}

/** Gravity directions: dr, dc, the wall bit on this side, the wall bit on the far side. */
export const DIRS: Record<number, readonly [number, number, number, number]> = {
  0: [1, 0, 4, 1],
  1: [0, -1, 8, 2],
  2: [-1, 0, 1, 4],
  3: [0, 1, 2, 8],
};

export type Pos = [number, number];

export interface Snap {
  pos: Pos;
  g: number;
  rot: number;
  turns: number;
  trail: string[];
}

export interface TiltState {
  p: TiltData;
  pos: Pos;
  /** Which way is down, in the maze's own frame (DIRS). */
  g: number;
  /** Quarter turns on screen, + right, − left (the page's rotate(rot·90deg)). */
  rot: number;
  turns: number;
  /** "r,c" of every square the ball has crossed, in the order first crossed. */
  trail: string[];
  hist: Snap[];
  solved: boolean;
  msg: string;
  /** What the last turn did: the squares rolled through and whether it went out. */
  last: { path: Pos[]; out: boolean; from: Pos } | null;
}

export type Move = { t: 'turn'; dir: 1 | -1 } | { t: 'undo' };

/** The engine's slide: from `pos`, falling in direction `g`. */
export function slide(p: TiltData, pos: Pos, g: number): { pos: Pos; out: boolean; path: Pos[] } {
  const N = p.n;
  let [r, c] = pos;
  const [dr, dc, bit] = DIRS[g]!;
  const path: Pos[] = [];
  for (;;) {
    if (p.walls[r]![c]! & bit) return { pos: [r, c], out: false, path };
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N)
      return { pos: [r, c], out: r === p.exit[0] && c === p.exit[1] && g === p.exit[2], path };
    r = r2;
    c = c2;
    path.push([r, c]);
  }
}

/** One leg of a way out: where it starts, the squares it rolls through, and its gravity. */
export type Leg = [Pos, Pos[], number];

/** The engine's shortest way out (its gate and the recap), or null when there is none. */
export function shortest(p: TiltData): { par: number; legs: Leg[] } | null {
  const k = (q: Pos, g: number) => q[0] * 400 + q[1] * 4 + g;
  const start = p.start;
  const prev = new Map<number, { from: number; leg: Leg } | null>([[k(start, 0), null]]);
  const queue: [Pos, number][] = [[start, 0]];
  while (queue.length) {
    const [pos, g] = queue.shift()!;
    const k0 = k(pos, g);
    for (const turn of [1, 3]) {
      const ng = (g + turn) % 4;
      const s = slide(p, pos, ng);
      const kk = k(s.pos, ng);
      if (s.out) {
        const legs: Leg[] = [[pos, s.path, ng]];
        let cur = k0;
        while (prev.get(cur)) {
          const q = prev.get(cur)!;
          legs.push(q.leg);
          cur = q.from;
        }
        legs.reverse();
        return { par: legs.length, legs };
      }
      if (!prev.has(kk)) {
        prev.set(kk, { from: k0, leg: [pos, s.path, ng] });
        queue.push([s.pos, ng]);
      }
    }
  }
  return null;
}

/** The page's ship gate: a maze that breaks these never renders. */
export function validate(data: unknown): { ok: boolean; checks: string[] } {
  const p = data as TiltData | null;
  if (
    !p ||
    !Number.isInteger(p.n) ||
    !Array.isArray(p.walls) ||
    p.walls.length !== p.n ||
    p.walls.some((r) => !Array.isArray(r) || r.length !== p.n) ||
    !Array.isArray(p.start) ||
    !Array.isArray(p.exit)
  )
    return { ok: false, checks: ['malformed maze'] };
  const N = p.n;
  const errs: string[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const w = p.walls[r]![c]!;
      if (c + 1 < N && !!(w & 2) !== !!(p.walls[r]![c + 1]! & 8)) errs.push('walls disagree');
      if (r + 1 < N && !!(w & 4) !== !!(p.walls[r + 1]![c]! & 1)) errs.push('walls disagree');
      for (let d = 0; d < 4; d++) {
        const r2 = r + DIRS[d]![0];
        const c2 = c + DIRS[d]![1];
        if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) {
          const isExit = r === p.exit[0] && c === p.exit[1] && d === p.exit[2];
          if (isExit === !!(w & DIRS[d]![2]))
            errs.push(isExit ? 'the exit is walled' : 'a gap in the outer wall');
        }
      }
    }
  if (!(p.walls[p.start[0]]![p.start[1]]! & 4)) errs.push('no floor under the ball');
  const s = errs.length ? null : shortest(p);
  if (!errs.length && !s) errs.push('no way out');
  if (s && s.par !== p.par) errs.push(`par ${p.par} is not the shortest way out (${s.par})`);
  return { ok: errs.length === 0, checks: errs };
}

export function init(p: TiltData): TiltState {
  return {
    p,
    pos: [p.start[0], p.start[1]],
    g: 0,
    rot: 0,
    turns: 0,
    trail: [],
    hist: [],
    solved: false,
    msg: START_MSG,
    last: null,
  };
}

const addAll = (trail: string[], keys: string[]) => {
  const out = trail.slice();
  for (const k of keys) if (!out.includes(k)) out.push(k);
  return out;
};

/** One move. A finished maze takes none, as the engine's guards. */
export function apply(s: TiltState, m: Move): TiltState {
  if (s.solved) return s;
  if (m.t === 'undo') {
    if (!s.hist.length) return s;
    const h = s.hist[s.hist.length - 1]!;
    return {
      ...s,
      pos: h.pos,
      g: h.g,
      rot: h.rot,
      turns: h.turns,
      trail: h.trail,
      hist: s.hist.slice(0, -1),
      msg: '',
      last: null,
    };
  }
  const hist = [
    ...s.hist,
    { pos: s.pos, g: s.g, rot: s.rot, turns: s.turns, trail: s.trail },
  ].slice(-UNDO_MAX);
  const g = (s.g + (m.dir > 0 ? 3 : 1)) % 4;
  const sl = slide(s.p, s.pos, g);
  const trail = addAll(s.trail, [
    `${s.pos[0]},${s.pos[1]}`,
    ...sl.path.map(([r, c]) => `${r},${c}`),
  ]);
  return {
    ...s,
    pos: sl.pos,
    g,
    rot: s.rot + m.dir,
    turns: s.turns + 1,
    trail,
    hist,
    solved: sl.out,
    msg: sl.out ? s.msg : sl.path.length ? '' : STILL_MSG,
    last: { path: sl.path, out: sl.out, from: s.pos },
  };
}

/** How long the page takes over the last turn: the quarter turn, the roll, and out. */
export function turnTime(s: TiltState): number {
  if (!s.last) return 0;
  return TURN_MS + rollMs(s.last.path.length) + (s.last.out ? OUT_MS : 0);
}

/** A square's centre in the page's drawing units. */
export const xy = (r: number, c: number): [number, number] => [
  PAD + c * CS + CS / 2,
  PAD + r * CS + CS / 2,
];

/** Where the ball is drawn: its square's centre, or past the gap once it has gone out. */
export function ballAt(s: TiltState, fresh: boolean): [number, number] {
  const [x, y] = xy(s.pos[0], s.pos[1]);
  if (!s.solved || !fresh) return [x, y];
  const [dr, dc] = DIRS[s.g]!;
  return [x + dc * CS * 1.4, y + dr * CS * 1.4];
}

/** The maze's side in drawing units (engines/tilt.js SIZE). */
export const size = (p: TiltData) => p.n * CS + PAD * 2;

/** "4 turns", "1 turn" (the engine's turnsDone). */
export const turnsText = (n: number) => `${n} turn${n === 1 ? '' : 's'}`;

/** The engine's fmt: rounded seconds as m:ss. */
export function timerText(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A finished maze as it reopens: the ball at the start, nothing turned, its saved turns. */
export function restoreDone(p: TiltData, turns: number): TiltState {
  return { ...init(p), turns, solved: true, msg: '' };
}

/** "Tilt 12" from "DP·TILT·0012". */
export const tiltNumber = (id: string) => parseInt(String(id).split('·').pop() ?? '', 10);

/** The recap's route: the ball's centre at the start, every square of the shortest way, past the gap. */
export function routePoints(p: TiltData): [number, number][] {
  const r = shortest(p);
  const pts: [number, number][] = [xy(p.start[0], p.start[1])];
  if (!r) return pts;
  for (const [, path] of r.legs) for (const [rr, c] of path) pts.push(xy(rr, c));
  const [er, ec, eg] = p.exit;
  const [dr, dc] = DIRS[eg]!;
  const [ex, ey] = xy(er, ec);
  pts.push([ex + dc * CS * 0.9, ey + dr * CS * 0.9]);
  return pts;
}

/** The walls to draw, as segments in drawing units: the inner ones, and the rim (heavier). */
export function wallSegments(p: TiltData): { inner: number[][]; rim: number[][] } {
  const N = p.n;
  const inner: number[][] = [];
  const rim: number[][] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const w = p.walls[r]![c]!;
      const x = PAD + c * CS;
      const y = PAD + r * CS;
      if (w & 1 && r === 0) rim.push([x, y, x + CS, y]);
      if (w & 8 && c === 0) rim.push([x, y, x, y + CS]);
      if (w & 2) (c === N - 1 ? rim : inner).push([x + CS, y, x + CS, y + CS]);
      if (w & 4) (r === N - 1 ? rim : inner).push([x, y + CS, x + CS, y + CS]);
    }
  return { inner, rim };
}
