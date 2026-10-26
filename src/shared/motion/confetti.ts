/**
 * The win's confetti, as the site throws it (engines/doku.js, mini.js, sweep.js, link.js
 * confettiBurst): square-ish pieces in the house colours fly out from the board's middle,
 * arc under gravity, spin and fade. Each piece's flight is worked out here once, as a few
 * points along its path, so the screen can draw it with one native-driven value.
 */

/** The site's frame: its physics steps once per 60 Hz frame. */
export const FRAME_MS = 1000 / 60;
/** The longest a piece lives, in frames (the site's 110 + up to 70). */
export const MAX_FRAMES = 180;
/** How long one burst is on screen. */
export const BURST_MS = Math.ceil(MAX_FRAMES * FRAME_MS);
/** The site's colours, in order (cobalt, marigold, green, navy, white). */
export const CONFETTI_COLORS = ['#2E5BFF', '#FFD54A', '#1F9E6B', '#1B3B9E', '#FFFFFF'] as const;
/** Points along each flight; straight lines between them read as a smooth arc. */
const STEPS = 8;

export interface Origin {
  x: number;
  y: number;
}

/** One piece's flight as interpolation points: input is the burst's progress, 0 to 1. */
export interface PieceTrack {
  w: number;
  h: number;
  color: string;
  input: number[];
  x: number[];
  y: number[];
  rotate: string[];
  opacity: number[];
}

/** Where a piece is `f` frames in, as the site's per-frame loop leaves it. */
export function flight(
  p: { vx: number; vy: number; g: number; rot: number; vr: number; max: number },
  f: number,
) {
  return {
    x: p.vx * f,
    // velocity grows by g each frame before the move, so the drop is g·f(f+1)/2
    y: p.vy * f + (p.g * f * (f + 1)) / 2,
    rot: p.rot + p.vr * f,
    alpha: Math.max(0, 1 - f / p.max),
  };
}

/** `n` pieces bursting from `origin`, with the site's spread of speeds, sizes and lives. */
export function makePieces(
  n: number,
  origin: Origin,
  rand: () => number = Math.random,
): PieceTrack[] {
  const pieces: PieceTrack[] = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const sp = 4 + rand() * 9;
    const w = 5 + rand() * 6;
    const p = {
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 8,
      g: 0.16,
      rot: rand() * 6.28,
      vr: -0.35 + rand() * 0.7,
      max: 110 + rand() * 70,
    };
    const t: PieceTrack = {
      w,
      h: w * 0.6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      input: [],
      x: [],
      y: [],
      rotate: [],
      opacity: [],
    };
    for (let k = 0; k <= STEPS; k++) {
      const f = (p.max * k) / STEPS;
      const at = flight(p, f);
      t.input.push(f / MAX_FRAMES);
      t.x.push(origin.x - w / 2 + at.x);
      t.y.push(origin.y - t.h / 2 + at.y);
      t.rotate.push(`${at.rot}rad`);
      t.opacity.push(at.alpha);
    }
    pieces.push(t);
  }
  return pieces;
}

type Listener = (n: number, origin: Origin) => void;
const listeners = new Set<Listener>();

/** Throw `n` pieces from `origin` (window points). Nothing happens with no host mounted. */
export function burst(n: number, origin: Origin): void {
  listeners.forEach((fn) => fn(n, origin));
}

/** The host's subscription. */
export function onBurst(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
